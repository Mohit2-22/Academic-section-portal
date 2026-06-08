import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """
    Establishes and returns a connection to the PostgreSQL database.
    Uses RealDictCursor so query results behave like Python dictionaries.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Please verify that your PostgreSQL server is running and the DATABASE_URL in .env is correct.")
        raise e

def execute_query(query, params=None, fetch=False):
    """
    Executes a database query, handles commit, and optionally fetches results.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            if fetch:
                results = cur.fetchall()
                # Convert RealDict to normal dict for JSON serialization
                return [dict(row) for row in results]
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
