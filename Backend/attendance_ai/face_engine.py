"""
Face Engine — Core CV logic for AI Attendance System.

Features:
  1. register_face()   — 5-10 base64 images → augment → average embedding → .npy
  2. recognize_face()  — single face match against stored embeddings
  3. recognize_multi() — YOLO-powered multi-face detection in a single classroom frame
  4. Image augmentation pipeline for robust embeddings

YOLO is used for fast, accurate face detection (bounding boxes).
DeepFace VGG-Face is used for face embedding / recognition.
"""

import os
import base64
import logging
import tempfile

import numpy as np
import cv2
from PIL import Image, ImageEnhance
from django.conf import settings

logger = logging.getLogger(__name__)

ENCODINGS_DIR = os.path.join(settings.MEDIA_ROOT, "face_encodings")
SNAPSHOTS_DIR = os.path.join(settings.MEDIA_ROOT, "attendance_snapshots")
MODEL_NAME = "VGG-Face"
SIMILARITY_THRESHOLD = 0.55          # cosine similarity threshold for match
LATE_THRESHOLD_MINUTES = 15          # minutes after start_time → mark as Late

os.makedirs(ENCODINGS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# ── OpenCV DNN Face Models (lightweight, no TensorFlow) ──────────────────────
_face_detector = None
_face_recognizer = None

FACE_DETECT_MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
FACE_RECOG_MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

FACE_DETECT_MODEL_PATH = os.path.join(settings.MEDIA_ROOT, "models", "yunet_face_detect.onnx")
FACE_RECOG_MODEL_PATH = os.path.join(settings.MEDIA_ROOT, "models", "sface_recognition.onnx")


def _download_model(url, path):
    """Download model file if not already present."""
    if os.path.exists(path):
        return True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        import requests as _req
        logger.info(f"Downloading model: {os.path.basename(path)}...")
        r = _req.get(url, timeout=60, stream=True)
        if r.status_code == 200:
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info(f"Model downloaded: {os.path.basename(path)}")
            return True
        logger.error(f"Model download failed: HTTP {r.status_code}")
        return False
    except Exception as e:
        logger.error(f"Model download error: {e}")
        return False


def _get_face_detector(width=320, height=320):
    """Lazy-load OpenCV YuNet face detector."""
    global _face_detector
    if _face_detector is None:
        if not _download_model(FACE_DETECT_MODEL_URL, FACE_DETECT_MODEL_PATH):
            return None
        _face_detector = cv2.FaceDetectorYN.create(
            FACE_DETECT_MODEL_PATH, "", (width, height),
            score_threshold=0.6, nms_threshold=0.3, top_k=5000
        )
    _face_detector.setInputSize((width, height))
    return _face_detector


def _get_face_recognizer():
    """Lazy-load OpenCV SFace recognizer."""
    global _face_recognizer
    if _face_recognizer is None:
        if not _download_model(FACE_RECOG_MODEL_URL, FACE_RECOG_MODEL_PATH):
            return None
        _face_recognizer = cv2.FaceRecognizerSF.create(
            FACE_RECOG_MODEL_PATH, ""
        )
    return _face_recognizer


# ── DeepFace lazy import (fallback, only used if installed) ───────────────────
_deepface = None


def _get_deepface():
    """Lazy-load DeepFace — returns None if not installed."""
    global _deepface
    if _deepface is None:
        try:
            from deepface import DeepFace
            _deepface = DeepFace
        except ImportError:
            logger.info("DeepFace not installed, using OpenCV SFace for embeddings.")
            return None
    return _deepface


# ── YOLO Face Detector lazy import ───────────────────────────────────────────
_yolo_model = None
YOLO_MODEL_PATH = os.path.join(settings.MEDIA_ROOT, "models", "yolov8n-face.pt")
YOLO_AVAILABLE = False


def _get_yolo():
    """Lazy-load YOLOv8 face detection model."""
    global _yolo_model, YOLO_AVAILABLE
    if _yolo_model is not None:
        return _yolo_model
    try:
        from ultralytics import YOLO
        model_dir = os.path.join(settings.MEDIA_ROOT, "models")
        os.makedirs(model_dir, exist_ok=True)

        if os.path.exists(YOLO_MODEL_PATH):
            _yolo_model = YOLO(YOLO_MODEL_PATH)
        else:
            # Download yolov8n-face model from HuggingFace / auto-download
            logger.info("Downloading YOLOv8 face model...")
            _yolo_model = YOLO("yolov8n.pt")   # fallback: object detection
            # Attempt specialized face model
            try:
                import requests as _req
                url = "https://github.com/akanametov/yolov8-face/releases/download/v0.0.0/yolov8n-face.pt"
                r = _req.get(url, timeout=30, stream=True)
                if r.status_code == 200:
                    with open(YOLO_MODEL_PATH, "wb") as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                    _yolo_model = YOLO(YOLO_MODEL_PATH)
                    logger.info("YOLOv8 face model downloaded successfully.")
            except Exception as dl_err:
                logger.warning(f"Face model download failed, using generic YOLO: {dl_err}")

        YOLO_AVAILABLE = True
        logger.info("YOLO face detector loaded successfully.")
        return _yolo_model
    except Exception as e:
        logger.warning(f"YOLO unavailable, falling back to OpenCV: {e}")
        YOLO_AVAILABLE = False
        return None


# ── OpenCV Haar cascade fallback ─────────────────────────────────────────────
_haar_cascade = None


def _get_haar_cascade():
    global _haar_cascade
    if _haar_cascade is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _haar_cascade = cv2.CascadeClassifier(cascade_path)
    return _haar_cascade


# ═══════════════════════════════════════════════════════════════════════════════
# IMAGE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════


def decode_base64_image(b64_string):
    """Convert base64 string from browser to numpy RGB array."""
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        img_bytes = base64.b64decode(b64_string.strip())
        np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    except Exception as e:
        logger.error(f"decode_base64_image error: {e}")
        return None


def augment_image(rgb_image):
    """
    Generate augmented variations of a single face image.
    Returns list of RGB numpy arrays (original + augmented).
    """
    augmented = [rgb_image]
    pil_img = Image.fromarray(rgb_image)
    h, w = rgb_image.shape[:2]

    augmented.append(np.fliplr(rgb_image).copy())

    for factor in [0.75, 0.85, 1.15, 1.30]:
        enhancer = ImageEnhance.Brightness(pil_img)
        augmented.append(np.array(enhancer.enhance(factor)))

    for factor in [0.8, 1.2]:
        enhancer = ImageEnhance.Contrast(pil_img)
        augmented.append(np.array(enhancer.enhance(factor)))

    augmented.append(cv2.GaussianBlur(rgb_image, (3, 3), 0))

    center = (w // 2, h // 2)
    for angle in [-10, -5, 5, 10]:
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(rgb_image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        augmented.append(rotated)

    return augmented


# ═══════════════════════════════════════════════════════════════════════════════
# FACE DETECTION — YOLO + OpenCV fallback
# ═══════════════════════════════════════════════════════════════════════════════


def detect_faces_yolo(rgb_image):
    """
    Detect all faces in an image.
    Robust multi-detector approach:
      1. YOLO Face (Best quality)
      2. OpenCV YuNet (Fast & Accurate)
      3. Haar Cascade (Reliable fallback)
    """
    faces = []
    h_img, w_img = rgb_image.shape[:2]
    
    # ── Preprocessing: CLAHE for better detection in varying light ──
    try:
        lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl,a,b))
        enhanced_rgb = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    except Exception:
        enhanced_rgb = rgb_image

    # 1. YOLO Detection
    yolo = _get_yolo()
    if yolo is not None and YOLO_AVAILABLE:
        try:
            bgr = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR)
            results = yolo(bgr, conf=0.20, verbose=False)
            for result in results:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    conf = float(box.conf[0])
                    
                    # Pad slightly for better recognition
                    pad_w, pad_h = int((x2-x1)*0.1), int((y2-y1)*0.1)
                    x1, y1 = max(0, x1-pad_w), max(0, y1-pad_h)
                    x2, y2 = min(w_img, x2+pad_w), min(h_img, y2+pad_h)
                    
                    if x2 - x1 < 20 or y2 - y1 < 20: continue
                    
                    face_crop = enhanced_rgb[y1:y2, x1:x2]
                    faces.append({
                        "x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1,
                        "confidence": conf, "face_crop": face_crop
                    })
            if faces: return faces
        except Exception as e:
            logger.error(f"YOLO detection error: {e}")

    # 2. YuNet Detection (Fast DNN)
    try:
        detector = _get_face_detector(w_img, h_img)
        if detector:
            bgr = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR)
            _, detections = detector.detect(bgr)
            if detections is not None:
                for det in detections:
                    bbox = det[0:4].astype(int)
                    conf = float(det[-1])
                    if conf < 0.5: continue
                    x, y, w, h = bbox
                    x, y = max(0, x), max(0, y)
                    x2, y2 = min(w_img, x+w), min(h_img, y+h)
                    
                    face_crop = enhanced_rgb[y:y2, x:x2]
                    faces.append({
                        "x": x, "y": y, "w": x2-x, "h": y2-y,
                        "confidence": conf, "face_crop": face_crop
                    })
            if faces: return faces
    except Exception as e:
        logger.error(f"YuNet detection error: {e}")

    # 3. Haar Cascade (The OG fallback)
    try:
        cascade = _get_haar_cascade()
        gray = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2GRAY)
        gray = cv2.equalizeHist(gray)
        rects = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40))
        
        for (x, y, w, h) in rects:
            face_crop = enhanced_rgb[y:y+h, x:x+w]
            faces.append({
                "x": x, "y": y, "w": w, "h": h,
                "confidence": 0.5, "face_crop": face_crop
            })
    except Exception as e:
        logger.error(f"Haar error: {e}")

    return faces


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDING EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════


def get_embedding(rgb_image, already_cropped=False):
    """
    Extract face embedding — uses OpenCV SFace (primary) or DeepFace (fallback).
    Returns normalized embedding vector (128-dim for SFace, 2622-dim for VGG-Face).
    """
    # ── Try OpenCV SFace (lightweight, no TensorFlow) ──
    recognizer = _get_face_recognizer()
    if recognizer is not None:
        try:
            # Convert RGB to BGR for OpenCV
            bgr_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
            h, w = bgr_image.shape[:2]

            if already_cropped:
                # Already a face crop — align and extract directly
                # SFace needs face landmarks, so detect face in the crop
                detector = _get_face_detector(w, h)
                if detector is not None:
                    _, faces_detected = detector.detect(bgr_image)
                    if faces_detected is not None and len(faces_detected) > 0:
                        face_aligned = recognizer.alignCrop(bgr_image, faces_detected[0])
                        embedding = recognizer.feature(face_aligned)
                        embedding = embedding.flatten().astype(np.float32)
                        norm = np.linalg.norm(embedding)
                        if norm > 0:
                            embedding = embedding / norm
                        return embedding

                # Fallback: try using the raw crop if detection failed in crop
                # Resize to 112x112 which is what SFace expects
                resized = cv2.resize(bgr_image, (112, 112))
                embedding = recognizer.feature(resized)
                embedding = embedding.flatten().astype(np.float32)
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                return embedding
            else:
                # Full image — detect face first, then extract embedding
                detector = _get_face_detector(w, h)
                if detector is not None:
                    _, faces_detected = detector.detect(bgr_image)
                    if faces_detected is not None and len(faces_detected) > 0:
                        face_aligned = recognizer.alignCrop(bgr_image, faces_detected[0])
                        embedding = recognizer.feature(face_aligned)
                        embedding = embedding.flatten().astype(np.float32)
                        norm = np.linalg.norm(embedding)
                        if norm > 0:
                            embedding = embedding / norm
                        return embedding
                    else:
                        logger.debug("SFace: no face detected in image")
                        return None
        except Exception as e:
            logger.warning(f"SFace embedding error: {e}")

    # ── Fallback: DeepFace (only if installed) ──
    DeepFace = _get_deepface()
    if DeepFace is not None:
        temp_path = None
        try:
            pil_img = Image.fromarray(rgb_image)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                temp_path = tmp.name
                pil_img.save(tmp, format="JPEG")

            if already_cropped:
                detector_backends = ["skip", "opencv"]
            else:
                detector_backends = ["opencv", "ssd", "skip"]

            result = None
            for backend in detector_backends:
                try:
                    result = DeepFace.represent(
                        img_path=temp_path,
                        model_name=MODEL_NAME,
                        enforce_detection=(backend != "skip"),
                        detector_backend=backend,
                        align=True
                    )
                    if result and len(result) > 0:
                        break
                except Exception as det_err:
                    logger.debug(f"detector '{backend}' failed: {det_err}")
                    continue

            if result and len(result) > 0:
                embedding = np.array(result[0]["embedding"], dtype=np.float32)
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                return embedding
            return None
        except Exception as e:
            logger.error(f"DeepFace get_embedding error: {e}")
            return None
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass

    logger.error("No face recognition backend available (neither SFace nor DeepFace)")
    return None



def get_all_embeddings_in_frame(rgb_image):
    """
    Detect ALL faces in a frame using YOLO (fast) then extract embedding per face.
    Returns list of {embedding, facial_area, detection_confidence}
    """
    faces = detect_faces_yolo(rgb_image)
    results = []

    for face_info in faces:
        face_crop = face_info["face_crop"]
        if face_crop is None or face_crop.size == 0:
            continue
            
        # Resize for faster embedding
        try:
            face_resized = cv2.resize(face_crop, (224, 224))
        except Exception:
            face_resized = face_crop

        # We pass already_cropped=True to skip redundant detection in DeepFace
        emb = get_embedding(face_resized, already_cropped=True)
        
        # We append even if emb is None, to show a box on UI
        results.append({
            "embedding": emb, # May be None
            "facial_area": {
                "x": face_info["x"],
                "y": face_info["y"],
                "w": face_info["w"],
                "h": face_info["h"],
            },
            "detection_confidence": face_info["confidence"],
        })

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# SIMILARITY
# ═══════════════════════════════════════════════════════════════════════════════


def cosine_similarity(vec1, vec2):
    """Cosine similarity between two vectors. Returns 0.0 on dimension mismatch."""
    if vec1.shape != vec2.shape:
        logger.debug(f"Dimension mismatch: live={vec1.shape} stored={vec2.shape}")
        return 0.0
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(vec1, vec2) / (norm1 * norm2))


# ═══════════════════════════════════════════════════════════════════════════════
# REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════════


def register_face(student_id, base64_images):
    """
    Enhanced registration flow:
    1. Take 5-10 base64 images from browser webcam
    2. For each image: generate augmented variations
    3. Extract face embedding from each augmented image
    4. Average ALL valid embeddings into one robust master vector
    5. Save as {student_id}.npy in ENCODINGS_DIR
    """
    all_embeddings = []
    failed_indices = []
    processed_originals = 0

    for idx, b64 in enumerate(base64_images):
        rgb = decode_base64_image(b64)
        if rgb is None:
            failed_indices.append(idx + 1)
            continue

        # Try YOLO crop first for cleaner face
        faces = detect_faces_yolo(rgb)
        if faces:
            rgb = cv2.resize(faces[0]["face_crop"], (224, 224))

        augmented_images = augment_image(rgb)
        original_embedding = None
        aug_count = 0

        for aug_img in augmented_images:
            embedding = get_embedding(aug_img)
            if embedding is not None:
                all_embeddings.append(embedding)
                aug_count += 1
                if original_embedding is None:
                    original_embedding = embedding

        if original_embedding is not None:
            processed_originals += 1
            logger.info(f"Registered sample {idx + 1}: {aug_count} augmented embeddings")
        else:
            failed_indices.append(idx + 1)
            logger.warning(f"Sample {idx + 1}: no face detected")

    if len(all_embeddings) < 1:
        return {
            "success": False,
            "message": "No valid face detected in any image. Ensure good lighting and face clearly visible.",
            "encoding_count": 0,
            "failed_indices": failed_indices,
        }

    master_embedding = np.mean(all_embeddings, axis=0)
    norm = np.linalg.norm(master_embedding)
    if norm > 0:
        master_embedding = master_embedding / norm

    npy_path = os.path.join(ENCODINGS_DIR, f"{student_id}.npy")
    np.save(npy_path, master_embedding)
    logger.info(f"Saved embedding for {student_id}: {processed_originals} originals, {len(all_embeddings)} augmented")

    return {
        "success": True,
        "message": f"Face registered with {processed_originals} photos ({len(all_embeddings)} augmented samples).",
        "encoding_count": processed_originals,
        "total_samples": len(all_embeddings),
        "encoding_path": npy_path,
        "failed_indices": failed_indices,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RECOGNITION — SINGLE FACE
# ═══════════════════════════════════════════════════════════════════════════════


def recognize_face(b64_frame, session_id=None):
    """Compare a single face against all stored embeddings. Returns best match."""
    rgb = decode_base64_image(b64_frame)
    if rgb is None:
        return {"status": "error", "message": "Cannot decode frame"}

    # Use YOLO to crop face first
    faces = detect_faces_yolo(rgb)
    if faces:
        face_rgb = cv2.resize(faces[0]["face_crop"], (224, 224))
    else:
        face_rgb = rgb

    live_embedding = get_embedding(face_rgb)
    if live_embedding is None:
        return {
            "status": "no_face",
            "message": "No face detected in frame",
            "recognized": False,
        }

    best_student_id = None
    best_score = 0.0

    npy_files = [f for f in os.listdir(ENCODINGS_DIR) if f.endswith(".npy")]
    if not npy_files:
        return {
            "status": "error",
            "message": "No registered students found.",
            "recognized": False,
        }

    for filename in npy_files:
        student_id = filename.replace(".npy", "")
        fpath = os.path.join(ENCODINGS_DIR, filename)
        try:
            stored_embedding = np.load(fpath)
        except Exception as e:
            logger.error(f"Failed to load {fpath}: {e}")
            continue

        score = cosine_similarity(live_embedding, stored_embedding)
        if score > best_score:
            best_score = score
            best_student_id = student_id

    logger.info(f"Best match: {best_student_id} with score {best_score:.4f}")
    confidence = round(best_score * 100, 2)

    if best_score < SIMILARITY_THRESHOLD:
        return {
            "status": "unknown",
            "message": "Face not recognized",
            "confidence": confidence,
            "recognized": False,
        }

    from datetime import date
    today = date.today().strftime("%Y-%m-%d")
    snap_dir = os.path.join(SNAPSHOTS_DIR, today)
    os.makedirs(snap_dir, exist_ok=True)

    suffix = f"_{session_id}" if session_id else ""
    snap_path = os.path.join(snap_dir, f"{best_student_id}{suffix}.jpg")
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.imwrite(snap_path, bgr)

    return {
        "status": "recognized",
        "student_id": best_student_id,
        "confidence": confidence,
        "snapshot_path": f"attendance_snapshots/{today}/{os.path.basename(snap_path)}",
        "message": "Student recognized",
        "recognized": True,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RECOGNITION — MULTI-FACE (classroom scanning) — YOLO powered
# ═══════════════════════════════════════════════════════════════════════════════


def recognize_multi_faces(b64_frame, session_id=None):
    """
    Detect and recognize ALL faces in a single frame.
    Used for classroom-wide attendance scanning.

    Returns:
      {
        "faces_detected": int,
        "recognized": [
          {"student_id": ..., "confidence": ..., "facial_area": ...},
        ],
        "unknown_count": int,
        "bounding_boxes": [{"x":.., "y":.., "w":.., "h":.., "label":.., "confidence":..}]
      }
    """
    rgb = decode_base64_image(b64_frame)
    if rgb is None:
        logger.error("recognize_multi_faces: Cannot decode base64 frame")
        return {"faces_detected": 0, "recognized": [], "unknown_count": 0,
                "bounding_boxes": [], "message": "Cannot decode frame"}

    logger.info(f"recognize_multi_faces: Frame decoded, shape={rgb.shape}")

    # Step 1: Detect faces (get bounding boxes)
    detected_faces = detect_faces_yolo(rgb)
    logger.info(f"recognize_multi_faces: Detected {len(detected_faces)} face(s)")

    if not detected_faces:
        # Last resort: Try single-face recognition
        logger.info("recognize_multi_faces: No faces from detector, trying single-face fallback")
        single = recognize_face(b64_frame, session_id)
        if single.get("recognized"):
            return {
                "faces_detected": 1,
                "recognized": [{
                    "student_id": single["student_id"],
                    "confidence": single["confidence"],
                    "snapshot_path": single.get("snapshot_path", ""),
                }],
                "unknown_count": 0,
                "bounding_boxes": [],
            }
        return {"faces_detected": 0, "recognized": [], "unknown_count": 0,
                "bounding_boxes": [], "message": "No faces detected in frame"}

    # Step 2: Load stored embeddings
    npy_files = [f for f in os.listdir(ENCODINGS_DIR) if f.endswith(".npy")]
    stored_embeddings = {}
    for filename in npy_files:
        sid = filename.replace(".npy", "")
        fpath = os.path.join(ENCODINGS_DIR, filename)
        try:
            stored_embeddings[sid] = np.load(fpath)
        except Exception:
            continue
    logger.info(f"recognize_multi_faces: Loaded {len(stored_embeddings)} stored embeddings")

    # Step 3: For each detected face, extract embedding and match
    recognized = []
    unknown_count = 0
    bounding_boxes = []

    for i, face_info in enumerate(detected_faces):
        area = {
            "x": face_info["x"],
            "y": face_info["y"],
            "w": face_info["w"],
            "h": face_info["h"],
        }

        # Extract embedding from face crop
        face_crop = face_info.get("face_crop")
        live_emb = None
        if face_crop is not None and face_crop.size > 0:
            try:
                face_resized = cv2.resize(face_crop, (224, 224))
                live_emb = get_embedding(face_resized, already_cropped=True)
            except Exception as emb_err:
                logger.warning(f"Face {i}: embedding extraction failed: {emb_err}")

        # Match against stored embeddings
        best_sid = None
        best_score = 0.0

        if live_emb is not None and len(stored_embeddings) > 0:
            for sid, stored_emb in stored_embeddings.items():
                score = cosine_similarity(live_emb, stored_emb)
                if score > best_score:
                    best_score = score
                    best_sid = sid
            logger.info(f"Face {i}: best match={best_sid}, score={best_score:.4f}")
        else:
            logger.info(f"Face {i}: no embedding extracted (emb={'ok' if live_emb is not None else 'None'}, stored={len(stored_embeddings)})")

        if best_score >= SIMILARITY_THRESHOLD and best_sid:
            recognized.append({
                "student_id": best_sid,
                "confidence": round(best_score * 100, 2),
                "facial_area": area,
            })
            bounding_boxes.append({
                "x": area["x"], "y": area["y"],
                "w": area["w"], "h": area["h"],
                "label": best_sid,
                "confidence": round(best_score * 100, 1),
                "recognized": True,
            })
        else:
            unknown_count += 1
            bounding_boxes.append({
                "x": area["x"], "y": area["y"],
                "w": area["w"], "h": area["h"],
                "label": "Unknown",
                "confidence": round(best_score * 100, 1),
                "recognized": False,
            })

    # Save snapshot
    try:
        from datetime import date
        today = date.today().strftime("%Y-%m-%d")
        snap_dir = os.path.join(SNAPSHOTS_DIR, today)
        os.makedirs(snap_dir, exist_ok=True)
        suffix = f"_multi_{session_id}" if session_id else "_multi"
        snap_path = os.path.join(snap_dir, f"classroom{suffix}.jpg")
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        cv2.imwrite(snap_path, bgr)
        snapshot_rel = f"attendance_snapshots/{today}/{os.path.basename(snap_path)}"
    except Exception as snap_err:
        logger.warning(f"Snapshot save failed: {snap_err}")
        snapshot_rel = ""

    logger.info(f"recognize_multi_faces DONE: {len(detected_faces)} detected, {len(recognized)} recognized, {unknown_count} unknown")

    return {
        "faces_detected": len(detected_faces),
        "recognized": recognized,
        "unknown_count": unknown_count,
        "bounding_boxes": bounding_boxes,
        "snapshot_path": snapshot_rel,
    }
