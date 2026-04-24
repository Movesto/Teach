import logging
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

from .config import DB_CONFIG

logger = logging.getLogger(__name__)
_db_pool: psycopg2.pool.ThreadedConnectionPool = None


def init_pool() -> None:
    global _db_pool
    _db_pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=2, maxconn=10,
        cursor_factory=RealDictCursor,
        **DB_CONFIG,
    )
    logger.info("DB connection pool initialised (min=2, max=10)")


def close_pool() -> None:
    if _db_pool:
        _db_pool.closeall()


def get_db():
    return _db_pool.getconn()


def release_db(conn) -> None:
    if conn is None:
        return
    try:
        conn.rollback()
    except Exception:
        pass
    _db_pool.putconn(conn)
