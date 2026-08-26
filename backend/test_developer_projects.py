import sys
import os
from fastapi.testclient import TestClient

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
from app.core.database import SessionLocal
from app.models.domain import Profile, Project, ProjectMember, Task, Role

client = TestClient(app)

def test_developer_projects_flow():
    db = SessionLocal()
    try:
        # 1. Retrieve the seed developer matching 'dev@sprintiq.ai'
        dev = db.query(Profile).filter(Profile.email == "dev@sprintiq.ai").first()
        if not dev:
            print("Seed developer not found. Seeding now...")
            # If not found, make sure roles and developer exist
            dev_role = db.query(Role).filter(Role.name == "developer").first()
            if not dev_role:
                dev_role = Role(name="developer", description="Developer")
                db.add(dev_role)
                db.flush()
            from app.core.security import get_password_hash
            dev = Profile(
                email="dev@sprintiq.ai",
                password_hash=get_password_hash("Dev@123"),
                full_name="Michael Chen (Dev)",
                role_id=dev_role.id,
                status="ACTIVE"
            )
            db.add(dev)
            db.commit()
            
        print(f"Developer profile: {dev.full_name} ({dev.email})")

        # 1.5. Ensure at least one project is assigned to this developer for detail path coverage
        my_project = db.query(Project).join(ProjectMember, ProjectMember.project_id == Project.id).filter(ProjectMember.user_id == dev.id).first()
        if not my_project:
            print("No project membership found for testing. Seeding dedicated developer project...")
            my_project = Project(
                name="Developer Assigned Project Alpha",
                key="DEV-ALPHA",
                status="ACTIVE"
            )
            db.add(my_project)
            db.flush()
            member_link = ProjectMember(
                project_id=my_project.id,
                user_id=dev.id,
                role_in_project="DEVELOPER"
            )
            db.add(member_link)
            db.commit()
            print(f"Seeded developer project DEV-ALPHA (id: {my_project.id})")

        # 2. Login to get JWT Token
        login_res = client.post("/api/auth/login", json={
            "email": "dev@sprintiq.ai",
            "password": "Dev@123",
            "remember_me": True
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Successfully authenticated as developer.")

        # 3. Request assigned projects list
        proj_res = client.get("/api/developer/projects", headers=headers)
        assert proj_res.status_code == 200, f"Get projects failed: {proj_res.text}"
        projects_data = proj_res.json()
        print(f"Assigned projects returned: {len(projects_data)}")
        assert len(projects_data) > 0, "Expected at least one assigned project in response."
        
        # Verify schema structure
        for proj in projects_data:
            assert "id" in proj
            assert "key" in proj
            assert "name" in proj
            assert "manager_name" in proj
            assert "progress_percentage" in proj
            assert "total_tasks" in proj
            assert "completed_tasks" in proj
            print(f"  Project: {proj['name']} ({proj['key']}) -> Progress: {proj['progress_percentage']}%")

        if len(projects_data) > 0:
            target_proj_id = projects_data[0]["id"]
            
            # 4. Request project details (Authorized)
            detail_res = client.get(f"/api/developer/projects/{target_proj_id}", headers=headers)
            assert detail_res.status_code == 200, f"Get project details failed: {detail_res.text}"
            detail_data = detail_res.json()
            assert "project" in detail_data
            assert "developer_summary" in detail_data
            assert "tasks" in detail_data
            assert "sprints" in detail_data
            assert "team" in detail_data
            print("Successfully retrieved authorized project details.")
            
        # 5. Request details for non-existent project (should be 404)
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        four_o_four_res = client.get(f"/api/developer/projects/{fake_uuid}", headers=headers)
        assert four_o_four_res.status_code == 404, f"Expected 404 not found, got {four_o_four_res.status_code}"
        print("Successfully verified 404 for non-existent project details.")

        # 6. Test project isolation: unauthorized project (should return 403 Forbidden)
        # Check if there's any project where dev is NOT a member and has no tasks
        all_projects = db.query(Project).all()
        unauthorized_proj_id = None
        for p in all_projects:
            is_member = db.query(ProjectMember).filter(
                ProjectMember.project_id == p.id,
                ProjectMember.user_id == dev.id
            ).first() is not None
            
            has_tasks = db.query(Task).filter(
                Task.project_id == p.id,
                Task.assigned_developer_id == dev.id
            ).count() > 0
            
            if not is_member and not has_tasks:
                unauthorized_proj_id = p.id
                break
                
        # If there is no unauthorized project, seed one for testing isolation
        if not unauthorized_proj_id:
            print("No unauthorized project found. Seeding isolation test project...")
            test_proj = Project(
                name="Strict Top Secret Project",
                key="SEC",
                status="ACTIVE"
            )
            db.add(test_proj)
            db.commit()
            unauthorized_proj_id = test_proj.id
            
        four_o_three_res = client.get(f"/api/developer/projects/{unauthorized_proj_id}", headers=headers)
        assert four_o_three_res.status_code == 403, f"Expected 403 Forbidden, got {four_o_three_res.status_code}"
        print("Successfully verified project isolation (403 Forbidden for unauthorized project).")
        
        print("Developer Projects security and validation test passed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    test_developer_projects_flow()
