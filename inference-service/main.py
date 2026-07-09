import io
import json
from contextlib import asynccontextmanager
from pathlib import Path

import timm
import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from torchvision import transforms

BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = "convnext_tiny.fb_in22k_ft_in1k"
MODEL_PATH = BASE_DIR / "model" / "convnext_tiny_best.pt"
DISEASE_LOOKUP_PATH = BASE_DIR / "disease_lookup.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

TRANSFORM = transforms.Compose(
    [
        transforms.Resize(255),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)

state = {}


def load_disease_lookup() -> dict:
    with open(DISEASE_LOOKUP_PATH, "r") as f:
        return json.load(f)


def load_model(checkpoint, num_classes: int) -> nn.Module:
    model = timm.create_model(MODEL_NAME, pretrained=False, num_classes=num_classes)
    if isinstance(checkpoint, dict):
        state_dict = checkpoint.get("model", checkpoint.get("state_dict", checkpoint))
    else:
        state_dict = checkpoint
    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model weights not found at {MODEL_PATH}. "
            "Place convnext_tiny_best.pt in inference-service/model/."
        )
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
    class_names = checkpoint["classes"]
    disease_lookup = load_disease_lookup()

    missing = [name for name in class_names if name not in disease_lookup]
    if missing:
        raise RuntimeError(
            "These class names have no matching key in disease_lookup.json: "
            f"{missing}. Every class must have a lookup entry."
        )

    state["class_names"] = class_names
    state["disease_lookup"] = disease_lookup
    state["model"] = load_model(checkpoint, num_classes=len(class_names))
    print(f"Inference service ready. Class order (index 0..{len(class_names) - 1}): {class_names}")
    yield
    state.clear()


app = FastAPI(title="Aeroseeds Inference Service", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded image.")

    input_tensor = TRANSFORM(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = state["model"](input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        predicted_idx = torch.argmax(probabilities)
        confidence = probabilities[predicted_idx].item()

    predicted_class = state["class_names"][predicted_idx.item()]
    disease_info = state["disease_lookup"].get(predicted_class, {})

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "disease_name": disease_info.get("disease_name", predicted_class),
        "cause": disease_info.get("causal_agent"),
        "symptoms": disease_info.get("symptoms_visible"),
        "treatment": disease_info.get("immediate_treatment"),
        "prevention": disease_info.get("prevention_next_season"),
    }
