"""
ULTRON - Industrial IoT Monitoring System
Logging module: configures rotating file + console handlers for the entire application.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

from app.config import settings


def setup_logger(name: str = "ultron") -> logging.Logger:
    """
    Create and return a named logger with:
      - Console handler (stdout)
      - Rotating file handler (logs/ultron.log, max 5 MB × 7 backups)
    """
    os.makedirs(settings.log.dir, exist_ok=True)

    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers when called multiple times (e.g. in tests)
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, settings.log.level, logging.INFO))

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # --- Console ---
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(fmt)
    logger.addHandler(console_handler)

    # --- Rotating file ---
    log_path = os.path.join(settings.log.dir, "ultron.log")
    file_handler = RotatingFileHandler(
        filename=log_path,
        maxBytes=settings.log.max_bytes,
        backupCount=settings.log.backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# Module-level logger used by the rest of the application
logger = setup_logger()
