"""uuid_and_timestamp

Revision ID: a565926645fe2
Revises: a565926645fe
Create Date: 2026-08-21 11:32:46.864197

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a565926645fe2'
down_revision: Union[str, Sequence[str], None] = 'a565926645fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated - manually adjusted for PostgreSQL compatibility ###
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Change ml_predictions.project_id from VARCHAR(36) to UUID
        op.alter_column(
            "ml_predictions",
            "project_id",
            type_=sa.UUID(),
            postgresql_using="project_id::uuid",
        )

        # Change task review schema columns from DATETIME to TIMESTAMP
        op.alter_column("tasks", "submitted_at", type_=sa.TIMESTAMP())
        op.alter_column("tasks", "reviewed_at", type_=sa.TIMESTAMP())

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated - manually adjusted for PostgreSQL compatibility ###
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Revert ml_predictions.project_id from UUID to VARCHAR(36)
        op.alter_column(
            "ml_predictions",
            "project_id",
            type_=sa.VARCHAR(36),
            postgresql_using="project_id::varchar(36)",
        )

        # Revert task review schema columns from TIMESTAMP to DateTime
        op.alter_column("tasks", "submitted_at", type_=sa.DateTime())
        op.alter_column("tasks", "reviewed_at", type_=sa.DateTime())

    # ### end Alembic commands ###