from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.ml.dataset_labels import CATEGORY_KNOWLEDGE, CLASS_LABELS, DATASET_NOTE
from app.ml.inference_engine import artifact_paths
from app.models import Crop, CropDisease, Disease, Model, ModelVersion, Role, User
from app.models.entities import ModelVersionStatus, UserRole


def seed_database(db: Session) -> None:
    for role in UserRole:
        if not db.query(Role).filter_by(name=role.value).first():
            db.add(Role(name=role.value, description=f"{role.value} role"))

    if not db.query(User).filter_by(email="admin@plantguard.ai").first():
        db.add(
            User(
                email="admin@plantguard.ai",
                password_hash=hash_password("ChangeMeAdmin123!"),
                full_name="PlantGuard Admin",
                role=UserRole.ADMIN.value,
                is_verified=True,
                is_active=True,
            )
        )

    # Single general crop profile — this dataset is pathogen-category, not crop-specific.
    crop = db.query(Crop).filter_by(slug="general-field-crops").first()
    if not crop:
        crop = Crop(
            name="General field crops",
            scientific_name=None,
            slug="general-field-crops",
            description=(
                "Multi-crop imagery used for broad visual pathogen-category classification "
                "(Bacteria, Fungi, Healthy, Pests, Virus)."
            ),
        )
        db.add(crop)
        db.flush()
    else:
        crop.description = (
            "Multi-crop imagery used for broad visual pathogen-category classification "
            "(Bacteria, Fungi, Healthy, Pests, Virus)."
        )

    keep_slugs = {d["slug"] for d in CATEGORY_KNOWLEDGE}
    # Remove legacy PlantVillage-style entries that do not match this dataset.
    for old in db.query(Disease).all():
        if old.slug not in keep_slugs and old.label_key not in CLASS_LABELS:
            db.query(CropDisease).filter_by(disease_id=old.id).delete()
            db.delete(old)
    db.flush()

    for d in CATEGORY_KNOWLEDGE:
        disease = db.query(Disease).filter_by(slug=d["slug"]).first()
        if not disease:
            disease = Disease(slug=d["slug"])
            db.add(disease)
        disease.name = d["name"]
        disease.description = d["description"]
        disease.pathogen_type = d["pathogen_type"]
        disease.pathogen_name = d["pathogen_name"]
        disease.symptoms = d["symptoms"]
        disease.cause = d["cause"]
        disease.prevention = d["prevention"]
        disease.management_notes = d["management_notes"]
        disease.source_metadata = d["source_metadata"]
        disease.label_key = d["label_key"]
        db.flush()

        link = (
            db.query(CropDisease)
            .filter_by(crop_id=crop.id, disease_id=disease.id)
            .first()
        )
        if not link:
            db.add(CropDisease(crop_id=crop.id, disease_id=disease.id))

    # Drop orphan crop links / unused crops from old seed
    for old_crop in db.query(Crop).all():
        if old_crop.slug != "general-field-crops":
            db.query(CropDisease).filter_by(crop_id=old_crop.id).delete()
            db.delete(old_crop)

    model = db.query(Model).filter_by(name="PlantGuard Pathogen Category CNN").first()
    if not model:
        model = Model(
            name="PlantGuard Pathogen Category CNN",
            architecture="resnet18",
            framework="pytorch",
            description=DATASET_NOTE,
        )
        db.add(model)
        db.flush()
    else:
        model.description = DATASET_NOTE

    weight_path, _ = artifact_paths()
    mv = (
        db.query(ModelVersion)
        .filter_by(model_id=model.id, version="pathogen-v1")
        .first()
    )
    if not mv:
        # Keep any previous production rows but add the dataset-aligned version.
        mv = ModelVersion(
            model_id=model.id,
            version="pathogen-v1",
            artifact_uri=str(weight_path),
            status=ModelVersionStatus.PRODUCTION.value,
            class_labels=CLASS_LABELS,
            f1_score=None,
        )
        db.add(mv)
    else:
        mv.class_labels = CLASS_LABELS
        mv.artifact_uri = str(weight_path)
        # Status is intentionally left alone so an admin promotion survives restarts.

    # Demote unrelated legacy production models so active labels stay consistent.
    for other in db.query(ModelVersion).filter_by(status=ModelVersionStatus.PRODUCTION.value).all():
        if other.model_id == model.id and other.version == "pathogen-v1":
            continue
        if other.class_labels != CLASS_LABELS:
            other.status = ModelVersionStatus.RETIRED.value

    _register_meta_versions(db, model, mv)
    db.commit()


def _register_meta_versions(db: Session, model: Model, primary: ModelVersion | None) -> None:
    """Register extra registry rows for artifacts that have a meta.json (candidates only)."""
    from app.core.config import settings

    root = settings.model_root
    candidates = [
        ("resnet18-cnn-v1", root / "production_cnn.pt", root / "production_cnn.meta.json"),
        ("sklearn-baseline-v1", root / "sklearn_baseline.pkl", root / "sklearn_baseline.meta.json"),
    ]
    primary_uri = primary.artifact_uri if primary is not None else None
    for version, weights, meta in candidates:
        if not meta.exists() or str(weights) == primary_uri:
            continue
        if db.query(ModelVersion).filter_by(model_id=model.id, version=version).first():
            continue
        db.add(
            ModelVersion(
                model_id=model.id,
                version=version,
                artifact_uri=str(weights),
                status=ModelVersionStatus.CANDIDATE.value,
                class_labels=CLASS_LABELS,
            )
        )
