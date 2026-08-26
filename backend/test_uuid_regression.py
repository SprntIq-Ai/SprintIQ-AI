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


def test_profile_role_uuid_coercion():
    """Verify that assigning a Python uuid.UUID to Profile.role_id, loading Profile.role,
    and compiling the query for PostgreSQL correctly binds the UUID value as a string
    without ::uuid cast, and lazy loading still succeeds.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import uuid
    from app.models.domain import Base, Profile, Role

    # Create an in-memory database to test the actual DB interaction loop
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. Create a Role
        role_id_str = str(uuid.uuid4())
        test_role = Role(
            id=role_id_str,
            name="test_dev",
            description="Test Developer"
        )
        session.add(test_role)
        session.commit()

        # 2. Simulate raw database driver retrieving UUID from a UUID column
        # by instantiating a Profile object with a python uuid.UUID object for role_id.
        role_id_uuid = uuid.UUID(role_id_str)
        profile_id = str(uuid.uuid4())
        test_profile = Profile(
            id=profile_id,
            email="test@sprintiq.ai",
            password_hash="fake",
            full_name="Test User",
            role_id=role_id_uuid  # Pass native Python uuid.UUID object!
        )
        session.add(test_profile)
        session.commit()
        session.expunge_all()

        # 3. Retrieve the profile from database
        retrieved_profile = session.query(Profile).filter(Profile.id == profile_id).one()

        # Verify role_id was coerced to string on load/use
        print(f"Retrieved profile.role_id: {retrieved_profile.role_id} (type: {type(retrieved_profile.role_id)})")
        assert isinstance(retrieved_profile.role_id, str), "role_id was not coerced to string"
        assert retrieved_profile.role_id == role_id_str

        # 4. Access the relationship to verify it loads without errors and resolves to the correct Role object
        resolved_role = retrieved_profile.role
        assert resolved_role is not None
        assert resolved_role.id == role_id_str
        print("PASS: Normal Role/Profile relationship lazy loading works with UUID input value.")

        # 5. Compile query for loading Profile.role with PostgreSQL dialect and verify type conversion at the dialect bind level
        from sqlalchemy.dialects import postgresql as pg_dialect
        dialect = pg_dialect.dialect()

        query = session.query(Role).filter(Role.id == role_id_uuid)
        compiled = query.statement.compile(dialect=dialect)
        sql_str = str(compiled)

        # Get and execute the custom bind parameter processor for this dialect
        bind_processor = Role.id.type.bind_processor(dialect)
        assert bind_processor is not None, "ForceString must supply a bind parameter processor"
        processed_param_value = bind_processor(role_id_uuid)
        print(f"Processed bind parameter value type: {type(processed_param_value)} (value: {processed_param_value})")

        assert isinstance(processed_param_value, str), f"Parameter was not coerced to string by bind processor, got {type(processed_param_value)}"
        assert "::uuid" not in sql_str.lower(), "Compiled SQL contains ::uuid cast!"

        print("PASS: PostgreSQL SQL query compilation contains no ::uuid cast and binds parameter as string.")
        return True
    finally:
        session.close()


if __name__ == "__main__":
    print("=" * 60)
    print("UUID -> String(36) Regression Tests")
    print("=" * 60)

    results = []
    results.append(("No UUID column types", test_no_uuid_column_types()))
    results.append(("No ::uuid cast in SQL", test_no_uuid_cast_in_compiled_sql()))
    results.append(("Compatibility fn is no-op", test_ensure_postgresql_compatibilities_is_noop()))
    results.append(("No UUID import in models", test_no_uuid_import_in_models()))
    results.append(("Role/Profile UUID Coercion Test", test_profile_role_uuid_coercion()))

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
