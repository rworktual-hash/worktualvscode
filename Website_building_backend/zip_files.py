import logging
import os
from typing import Dict
import zipfile


def zip_directory(src_dir: str, zip_path: str):
  os.makedirs(os.path.dirname(zip_path), exist_ok=True)
  
  if os.path.exists(zip_path):
    os.remove(zip_path)
  with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, _, files in os.walk(src_dir):
      for file in files:
        full_path = os.path.join(root, file)
        arc_name = os.path.relpath(full_path, src_dir)
        zipf.write(full_path, arcname=arc_name)


logger = logging.getLogger("ai-site-generator")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')



# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')



def read_current_project_files(base_dir: str, max_file_size_mb: int = 5) -> Dict[str, str]:
    """
    Reads all text-based files from a project directory for editing.
    Skips binary files, ignored dirs, and files larger than max_file_size_mb.
    """
    files_content = {}
    if not os.path.exists(base_dir):
        return files_content

    ignore_dirs = {".git", "node_modules", "dist"}
    ignore_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".zip", ".lock", ".pdf", ".mp4"}

    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, base_dir)
            if any(rel_path.lower().endswith(ext) for ext in ignore_exts):
                continue
            if os.path.getsize(full_path) > max_file_size_mb * 1024 * 1024:
                logger.warning(f"Skipping large file {rel_path}")
                continue
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    files_content[rel_path] = f.read()
            except UnicodeDecodeError:
                logger.warning(f"Skipping binary or non-text file {rel_path}")
            except Exception as e:
                logger.warning(f"Could not read file {rel_path}: {e}")

    return files_content


def read_current_project_files(base_dir: str, max_file_size_mb: int = 5) -> Dict[str, str]:
    """
    Reads all text-based files from a project directory for editing.
    Skips binary files, ignored dirs, and files larger than max_file_size_mb.
    """
    files_content = {}
    if not os.path.exists(base_dir):
        return files_content

    ignore_dirs = {".git", "node_modules", "dist"}
    ignore_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".zip", ".lock", ".pdf", ".mp4"}

    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, base_dir)
            if any(rel_path.lower().endswith(ext) for ext in ignore_exts):
                continue
            if os.path.getsize(full_path) > max_file_size_mb * 1024 * 1024:
                logger.warning(f"Skipping large file {rel_path}")
                continue
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    files_content[rel_path] = f.read()
            except UnicodeDecodeError:
                logger.warning(f"Skipping binary or non-text file {rel_path}")
            except Exception as e:
                logger.warning(f"Could not read file {rel_path}: {e}")

    return files_content


