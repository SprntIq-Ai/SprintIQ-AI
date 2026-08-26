"""
Regression test: Verify that all SQLAlchemy model identity/FK columns use String(36)
instead of UUID, preventing ::uuid casts against VARCHAR production columns.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import String, inspect as sa_inspect
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.core.database import Base, ensure_postgresql_compatibilities
from app.models import domain  # Force all models to register with Base


def test_no_uuid_column_types():
    """Every identity/FK column must be String(36), not UUID."""
    failures = []
    for table_name, table in Base.metadata.tables.items():
        for col in table.columns:
            col_type = type(col.type)
            if col_type is PG_UUID:
                failures.append(f"  {table_name}.{col.name} -> {col.type} (should be String(36))")

    if failures:
        print("FAIL: The following columns still use UUID type:")
        for f in failures:
            print(f)
        return False
    else:
        print("PASS: All columns use String(36). No UUID types found.")
        return True


def test_no_uuid_cast_in_compiled_sql():
    """Compile a representative query and verify no ::uuid cast appears."""
    from sqlalchemy.orm import Session
    from sqlalchemy import create_engine
    from app.models.domain import Profile

    # Use PostgreSQL dialect for compilation to catch ::uuid casts
    from sqlalchemy.dialects import postgresql as pg_dialect

    query = Session().query(Profile).filter(Profile.id == "test-uuid-string")
    compiled = query.statement.compile(dialect=pg_dialect.dialect())
    sql_str = str(compiled)

    if "::uuid" in sql_str.lower():
        print(f"FAIL: Compiled SQL contains ::uuid cast:\n  {sql_str}")
        return False
    else:
        print(f"PASS: No ::uuid cast in compiled SQL:\n  {sql_str}")
        return True


def test_ensure_postgresql_compatibilities_is_noop():
    """The startup compatibility function must not execute any ALTER TABLE."""
    import io
    from contextlib import redirect_stdout

    captured = io.StringIO()
    with redirect_stdout(captured):
        ensure_postgresql_compatibilities(None)  # Should accept None since it's a no-op

    output = captured.getvalue()
    if "Skipped" in output:
        print(f"PASS: ensure_postgresql_compatibilities is a no-op: {output.strip()}")
        return True
    else:
        print(f"FAIL: ensure_postgresql_compatibilities did unexpected work: {output.strip()}")
        return False


def test_no_uuid_import_in_models():
    """The domain models file must not import sqlalchemy UUID."""
    model_file = os.path.join(os.path.dirname(__file__), "app", "models", "domain.py")
    with open(model_file, "r") as f:
        content = f.read()

    if "from sqlalchemy.dialects.postgresql import UUID" in content:
        print("FAIL: domain.py still imports sqlalchemy UUID")
        return False
    else:
        print("PASS: domain.py does not import sqlalchemy UUID")
        return True


if __name__ == "__main__":
    print("=" * 60)
    print("UUID -> String(36) Regression Tests")
    print("=" * 60)

    results = []
    results.append(("No UUID column types", test_no_uuid_column_types()))
    results.append(("No ::uuid cast in SQL", test_no_uuid_cast_in_compiled_sql()))
    results.append(("Compatibility fn is no-op", test_ensure_postgresql_compatibilities_is_noop()))
    results.append(("No UUID import in models", test_no_uuid_import_in_models()))

    print("\n" + "=" * 60)
    print("Results:")
    all_pass = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status}: {name}")
        if not passed:
            all_pass = False

    print("=" * 60)
    if all_pass:
        print("ALL REGRESSION TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
    sys.exit(0 if all_pass else 1)
