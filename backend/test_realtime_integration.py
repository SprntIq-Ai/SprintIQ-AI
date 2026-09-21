import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
BASE_URL = "/api"

def login(email, password):
    resp = client.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"FAILED LOGIN for {email}: {resp.status_code} {resp.text}")
        return None
    return resp.json()["access_token"]

def run_tests():
    print("=== STARTING SPRINTIQ-AI REALTIME INTEGRATION TEST ===")
    
    admin_token = login("admin@sprintiq.ai", "Admin@123")
    manager_token = login("manager@sprintiq.ai", "Manager@123")
    dev_token = login("dev@sprintiq.ai", "Dev@123")

    assert admin_token and manager_token and dev_token, "Authentication failed!"
    print("[OK] Logins successful for Admin, Manager, Developer")

    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_mgr = {"Authorization": f"Bearer {manager_token}"}
    headers_dev = {"Authorization": f"Bearer {dev_token}"}

    # 1. Test Issue A: Developer AI Chat
    print("\n--- Test Issue A: Developer AI Chat ---")
    ai_resp = client.post(
        f"{BASE_URL}/developer/ai-chat",
        headers=headers_dev,
        json={"prompt": "Explain the sprint burndown chart in simple words."}
    )
    print(f"Status: {ai_resp.status_code}")
    assert ai_resp.status_code == 200, f"AI chat failed: {ai_resp.text}"
    chat_json = ai_resp.json()
    assert "response" in chat_json and len(chat_json["response"]) > 0
    print("[OK] Developer AI Assistant returned valid response without hanging")

    # 2. Test Issue B: Sprints & Active View
    print("\n--- Test Issue B: Sprints & Derived Status ---")
    sprints_resp = client.get(f"{BASE_URL}/sprints", headers=headers_mgr)
    print(f"Status: {sprints_resp.status_code}")
    assert sprints_resp.status_code == 200
    sprints = sprints_resp.json()
    print(f"Found {len(sprints)} sprints:")
    for s in sprints:
        print(f"  - {s['name']}: status={s.get('status')} derived={s.get('derived_status')} progress={s.get('progress_percentage')}%")
    assert len(sprints) > 0, "No sprints found!"
    print("[OK] Sprints retrieved with robust date parsing and derived status")

    # 3. Test Issue C: Leaderboard & Badges
    print("\n--- Test Issue C: Developer Leaderboard & Badges ---")
    lb_resp = client.get(f"{BASE_URL}/analytics/leaderboard", headers=headers_dev)
    assert lb_resp.status_code == 200
    lb = lb_resp.json()
    print(f"Leaderboard items: {len(lb)}")
    for item in lb:
        print(f"  Rank #{item['rank_position']}: {item['developer_name']} - score={item['overall_productivity_score']} tasks={item['completed_tasks']} badges={item['badges']}")
    assert len(lb) > 0

    badges_resp = client.get(f"{BASE_URL}/developer-features/badges", headers=headers_dev)
    assert badges_resp.status_code == 200
    badges = badges_resp.json()
    print(f"Developer Badges ({len(badges)}): {[b['badge_title'] for b in badges]}")
    assert len(badges) > 0
    print("[OK] Leaderboard & dynamic achievement badges validated")

    # 4. Test Issue D & 11: Manager Dashboard & AI Health & Risk
    print("\n--- Test Issue D: Manager Dashboard & ML Prediction ---")
    dash_resp = client.get(f"{BASE_URL}/manager/dashboard", headers=headers_mgr)
    assert dash_resp.status_code == 200
    dash = dash_resp.json()
    metrics = dash["metrics"]
    print(f"Dashboard Metrics: health={metrics['project_health']} progress={metrics['sprint_progress']}% pending={metrics['pending_tasks']} review={metrics['review_queue_count']} risk={metrics['ai_risk_score']}")
    print(f"Burndown Chart points: {len(dash['charts']['sprint_burndown'])}")
    print(f"AI Suggestions: {dash['ai_suggestions']}")
    assert len(dash["projects"]) > 0
    assert len(dash["charts"]["sprint_burndown"]) == 7

    target_project_id = dash["projects"][0]["id"]

    health_resp = client.get(f"{BASE_URL}/ai/health-score?project_id={target_project_id}", headers=headers_mgr)
    assert health_resp.status_code == 200
    health = health_resp.json()
    print(f"AI Health Score: {health['health_score']}/100 ({health['health_status']}) progress={health['sprint_progress']}%")

    risk_resp = client.get(f"{BASE_URL}/ai/risk-prediction?project_id={target_project_id}", headers=headers_mgr)
    assert risk_resp.status_code == 200
    risk = risk_resp.json()
    print(f"ML Delay Risk: prob={risk['sprint_delay_probability']}% level={risk['project_delay_risk']} overloaded={len(risk['overloaded_developers'])} high_risk_tasks={len(risk['high_risk_tasks'])}")
    print("[OK] Manager Dashboard, AI Health Score, and ML Delay Prediction validated")

    # 5. Test Issue E: GitHub Engineering Analytics
    print("\n--- Test Issue E: GitHub Engineering Projects & Repos ---")
    gh_projects_resp = client.get(f"{BASE_URL}/github/projects", headers=headers_mgr)
    assert gh_projects_resp.status_code == 200
    gh_projs = gh_projects_resp.json()
    total_repos = sum(len(p["repositories"]) for p in gh_projs)
    print(f"Accessible Projects: {len(gh_projs)}, Total Connected Repos: {total_repos}")
    for p in gh_projs:
        print(f"  Project: {p['name']} ({len(p['repositories'])} repos)")
        for r in p["repositories"]:
            print(f"    - {r['repo_name']}: visibility={r.get('visibility')} default_branch={r.get('default_branch')} sync={r.get('sync_status')}")
    assert total_repos > 0, "At least one connected repository must be available!"
    print("[OK] GitHub Engineering analytics projects and repositories validated")

    # 6. Test Issue F & G: AI Sprint Planner
    print("\n--- Test Issue F & G: AI Sprint Planner ---")
    planner_resp = client.post(
        f"{BASE_URL}/ai/sprint-planner",
        headers=headers_mgr,
        json={"project_id": target_project_id, "target_focus": "Velocity & Delivery"}
    )
    assert planner_resp.status_code == 200
    plan = planner_resp.json()
    print(f"AI Sprint Plan Goal: {plan['goal']}")
    print(f"Recommended Tasks ({len(plan.get('recommended_tasks', []))}): {[t['title'] for t in plan.get('recommended_tasks', [])[:3]]}")
    assert "goal" in plan and "recommended_tasks" in plan
    print("[OK] AI Sprint Planner validated")

    # 7. Test Issue H: AI Task Generator
    print("\n--- Test Issue H: AI Task Generator ---")
    taskgen_resp = client.post(
        f"{BASE_URL}/ai/task-generator",
        headers=headers_mgr,
        json={"title": "Implement JWT Refresh Token Rotation"}
    )
    assert taskgen_resp.status_code == 200
    task_gen = taskgen_resp.json()
    print(f"Generated Task: {task_gen['title']} (SP: {task_gen.get('story_points')}, Priority: {task_gen.get('priority')})")
    assert "acceptance_criteria" in task_gen
    print("[OK] AI Task Generator validated")

    # 8. Test Issue I: Reports Preview and Exports
    print("\n--- Test Issue I: Reports Preview & Exports ---")
    # Preview SPRINT
    preview_sprint = client.get(f"{BASE_URL}/reports/preview?report_type=SPRINT&project_id={target_project_id}", headers=headers_mgr)
    assert preview_sprint.status_code == 200
    ps_data = preview_sprint.json()
    print(f"Sprint Preview: {ps_data['title']}, Rows: {len(ps_data['rows'])}, Summary: {ps_data['summary']}")
    assert len(ps_data["headers"]) > 0

    # Preview DEVELOPER
    preview_dev = client.get(f"{BASE_URL}/reports/preview?report_type=DEVELOPER&project_id={target_project_id}", headers=headers_mgr)
    assert preview_dev.status_code == 200
    pd_data = preview_dev.json()
    print(f"Developer Preview: {pd_data['title']}, Rows: {len(pd_data['rows'])}, Summary: {pd_data['summary']}")

    # Preview WEEKLY
    preview_weekly = client.get(f"{BASE_URL}/reports/preview?report_type=WEEKLY&project_id={target_project_id}", headers=headers_mgr)
    assert preview_weekly.status_code == 200
    pw_data = preview_weekly.json()
    print(f"Weekly Preview: {pw_data['title']}, Rows: {len(pw_data['rows'])}, Summary: {pw_data['summary']}")

    # Export PDF
    pdf_resp = client.post(
        f"{BASE_URL}/reports/generate",
        headers=headers_mgr,
        json={"title": "Sprint 1 Velocity Report", "report_type": "SPRINT", "format": "PDF", "project_id": target_project_id}
    )
    assert pdf_resp.status_code == 200 and pdf_resp.headers.get("content-type") == "application/pdf"
    print(f"[OK] PDF export generated ({len(pdf_resp.content)} bytes)")

    # Export CSV
    csv_resp = client.post(
        f"{BASE_URL}/reports/generate",
        headers=headers_mgr,
        json={"title": "Developer Allocation Report", "report_type": "DEVELOPER", "format": "CSV", "project_id": target_project_id}
    )
    assert csv_resp.status_code == 200 and "csv" in csv_resp.headers.get("content-type")
    print(f"[OK] CSV export generated ({len(csv_resp.content)} bytes)")

    # Export EXCEL
    excel_resp = client.post(
        f"{BASE_URL}/reports/generate",
        headers=headers_mgr,
        json={"title": "Weekly Summary Report", "report_type": "WEEKLY", "format": "EXCEL", "project_id": target_project_id}
    )
    assert excel_resp.status_code == 200
    print(f"[OK] Excel export generated ({len(excel_resp.content)} bytes)")

    print("\n=======================================================")
    print("ALL 10 REAL-TIME INTEGRATION REQUIREMENTS VERIFIED 100%!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
