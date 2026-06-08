"""
File Manager — secure upload & download handling for materials and videos
"""
import os
import uuid
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(__file__)
UPLOAD_BASE = os.path.join(BASE_DIR, "uploads")

ALLOWED_MATERIAL_EXTENSIONS = {'.pdf', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.docx', '.doc', '.txt', '.zip'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.webm', '.avi', '.mov', '.mkv'}
MAX_MATERIAL_SIZE = 50 * 1024 * 1024   # 50 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024     # 500 MB

# Ensure upload dirs exist
for subdir in ['materials', 'videos', 'certificates']:
    os.makedirs(os.path.join(UPLOAD_BASE, subdir), exist_ok=True)


def _get_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def save_material(file_storage) -> dict:
    """
    Save an uploaded material file (PDF, CSV, XLSX etc.)
    file_storage: Flask's FileStorage object
    Returns dict with file_name, file_path, file_type, file_size_bytes
    """
    original_name = secure_filename(file_storage.filename)
    ext = _get_extension(original_name)
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        raise ValueError(f"File type '{ext}' not allowed. Allowed: {ALLOWED_MATERIAL_EXTENSIONS}")

    # Read to check size
    file_bytes = file_storage.read()
    if len(file_bytes) > MAX_MATERIAL_SIZE:
        raise ValueError(f"File too large. Max allowed: {MAX_MATERIAL_SIZE // (1024*1024)} MB")

    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    save_path = os.path.join(UPLOAD_BASE, 'materials', unique_name)

    with open(save_path, 'wb') as f:
        f.write(file_bytes)

    return {
        'file_name': original_name,
        'file_path': save_path,
        'file_type': ext.lstrip('.').upper(),
        'file_size_bytes': len(file_bytes)
    }


def save_video(file_storage) -> dict:
    """
    Save an uploaded video tutorial file.
    Returns dict with file_name, file_path
    """
    original_name = secure_filename(file_storage.filename)
    ext = _get_extension(original_name)
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError(f"Video type '{ext}' not allowed. Allowed: {ALLOWED_VIDEO_EXTENSIONS}")

    file_bytes = file_storage.read()
    if len(file_bytes) > MAX_VIDEO_SIZE:
        raise ValueError(f"Video too large. Max allowed: {MAX_VIDEO_SIZE // (1024*1024)} MB")

    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    save_path = os.path.join(UPLOAD_BASE, 'videos', unique_name)

    with open(save_path, 'wb') as f:
        f.write(file_bytes)

    return {
        'file_name': original_name,
        'file_path': save_path
    }


def get_material_path(file_path: str) -> str:
    """Return safe absolute path to a material file."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Material file not found: {file_path}")
    # Ensure it's within our uploads directory
    real_path = os.path.realpath(file_path)
    real_base = os.path.realpath(UPLOAD_BASE)
    if not real_path.startswith(real_base):
        raise PermissionError("Access denied: file outside upload directory")
    return real_path


def get_video_path(file_path: str) -> str:
    """Return safe absolute path to a video file."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Video file not found: {file_path}")
    real_path = os.path.realpath(file_path)
    real_base = os.path.realpath(UPLOAD_BASE)
    if not real_path.startswith(real_base):
        raise PermissionError("Access denied: file outside upload directory")
    return real_path


def format_file_size(size_bytes: int) -> str:
    """Human-readable file size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024*1024):.1f} MB"
    return f"{size_bytes / (1024*1024*1024):.1f} GB"
