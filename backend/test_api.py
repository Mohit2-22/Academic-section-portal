import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def test_db_connection():
    print("---------------------------------------------")
    print("Database Connection Verification Script")
    print("---------------------------------------------")
    print(f"DATABASE_URL configured in .env: {DATABASE_URL}")
    print("Attempting to connect to PostgreSQL...")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print(" SUCCESS: Successfully connected to PostgreSQL!")
        
        cur = conn.cursor()
        
        # Check tables
        tables = ['students', 'courses', 'student_courses', 'admissions', 'fees']
        print("\nVerifying tables:")
        for table in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table};")
                count = cur.fetchone()[0]
                print(f"  - Table '{table}': EXISTS (Contains {count} records)")
            except Exception as table_err:
                print(f"  - Table '{table}': NOT FOUND or error: {table_err}")
                conn.rollback()
                
        cur.close()
        conn.close()
        print("\nAll database checks completed successfully.")
        return True
    except Exception as e:
        print("\n ERROR: Failed to connect to PostgreSQL database.")
        print(f"Details: {e}")
        print("\nTroubleshooting Tips:")
        print("1. Ensure PostgreSQL is installed and running on your machine.")
        print("2. Verify that the credentials in your '.env' file are correct.")
        print("3. Ensure that the target database actually exists in PostgreSQL.")
        print("   You can create it by running in your pgAdmin or psql console:")
        print("   CREATE DATABASE computer_institute;")
        print("4. After creating the database, run this command to create tables & seed mock data:")
        print("   python init_db.py")
        print("---------------------------------------------")
        return False

if __name__ == "__main__":
    success = test_db_connection()
    sys.exit(0 if success else 1)
