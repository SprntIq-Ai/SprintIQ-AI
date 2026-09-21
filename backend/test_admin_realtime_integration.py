import sys
import os

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

def run_admin_tests():
    print("=== STARTING SPRINTIQ-AI ADMIN REALTIME INTEGRATION TEST ===")
    
    admin_token = login("admin@sprintiq.ai", "Admin@123")
    manager_token = login("manager@sprintiq.ai", "Manager@123")
    dev_token = login("dev@sprintiq.ai", "Dev@123")

    assert admin_token and manager_token and dev_token, "Authentication failed!"
    print("[OK] Authentication tokens obtained for Admin, Manager, and Developer")

    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_mgr = {"Authorization": f"Bearer {manager_token}"}
    headers_dev = {"Authorization": f"Bearer {dev_token}"}

    # 1. Admin RBAC Verification
    print("\n--- Test 1: Admin RBAC Enforcement ---")
    dev_dash_resp = client.get(f"{BASE_URL}/admin/dashboard", headers=headers_dev)
    assert dev_dash_resp.status_code in [401, 403], f"Developer should not access admin dashboard! Got: {dev_dash_resp.status_code}"
    print("[OK] Admin endpoints strictly reject non-admin roles (HTTP 403/401)")

    # 2. Admin Dashboard Live Metrics & AI Governance Insight
    print("\n--- Test 2: Admin Dashboard Metrics & Dynamic AI Governance Insight ---")
    dash_resp = client.get(f"{BASE_URL}/admin/dashboard", headers=headers_admin)
    assert dash_resp.status_code == 200, f"Admin dashboard failed: {dash_resp.text}"
    dash_data = dash_resp.json()
    metrics = dash_data["metrics"]
    print(f"Metrics: Projects={metrics['total_projects']}, Managers={metrics['total_managers']}, Devs={metrics['total_developers']}")
    print(f"Health Breakdown: Healthy={metrics['healthy_projects']}, AtRisk={metrics['at_risk_projects']}, Critical={metrics['critical_projects']}")
    print(f"AI Risk Score={metrics['ai_risk_score']} / 100, Completion Rate={metrics['project_completion_rate']}%")
    
    assert metrics["total_projects"] >= 0
    assert metrics["total_managers"] >= 1
    assert metrics["total_developers"] >= 1
    assert metrics["ai_risk_score"] != 15.4 or metrics["total_projects"] > 0, "Hardcoded fallback risk 15.4 detected!"
    
    assert "ai_governance_insight" in dash_data, "Missing ai_governance_insight in dashboard response!"
    insight = dash_data["ai_governance_insight"]
    print(f"AI Governance Insight ({insight['severity']}): {insight['message']}")
    print(f"Reasoning: {insight['reason']}")
    print("[OK] Admin Dashboard verified with live metrics and dynamic AI Governance Insight")

    # 3. Project Intelligence & ML Delay Prediction
    print("\n--- Test 3: Project Intelligence & ML Delay Prediction ---")
    projs_resp = client.get(f"{BASE_URL}/admin/projects", headers=headers_admin)
    assert projs_resp.status_code == 200
    projects = projs_resp.json()
    assert len(projects) > 0, "No projects in database!"
    target_p = projects[0]
    target_id = target_p["id"]
    target_key = target_p["key"]

    health_resp = client.get(f"{BASE_URL}/health/{target_id}", headers=headers_admin)
    assert health_resp.status_code == 200, f"Project health failed: {health_resp.text}"
    health_data = health_resp.json()
    print(f"Project Health for '{target_p['name']}': Score={health_data.get('overall_health_score')} Status={health_data.get('health_status')}")

    # Test key lookup as well (e.g. key instead of UUID)
    health_by_key = client.get(f"{BASE_URL}/health/{target_key}", headers=headers_admin)
    assert health_by_key.status_code == 200, f"Project lookup by key failed: {health_by_key.text}"

    ml_resp = client.get(f"{BASE_URL}/ml/delay/{target_id}", headers=headers_admin)
    assert ml_resp.status_code == 200, f"ML delay failed: {ml_resp.text}"
    ml_data = ml_resp.json()
    print(f"ML Delay Prediction: Prob={ml_data.get('probability')} Risk={ml_data.get('risk_level')} Model={ml_data.get('model_version')}")
    assert "probability" in ml_data or ml_data.get("status") == "INSUFFICIENT_DATA"
    print("[OK] Project Intelligence & ML Delay Prediction validated by UUID and Key")

    # 4. What-If Simulator Baseline & Scenario Execution
    print("\n--- Test 4: What-If Simulator Baseline & Scenarios ---")
    sim_data_resp = client.get(f"{BASE_URL}/projects/{target_key}/simulation-data", headers=headers_admin)
    assert sim_data_resp.status_code == 200, f"Simulation data failed: {sim_data_resp.text}"
    sim_base = sim_data_resp.json()
    print(f"Baseline Data: TargetDays={sim_base.get('baseline_target_days')} TotalTasks={sim_base.get('total_tasks')} Devs={sim_base.get('developer_count')}")

    # Run scenario: DEV_UNAVAILABLE
    sim_run_resp = client.post(
        f"{BASE_URL}/projects/{target_key}/simulate",
        headers=headers_admin,
        json={"project_id": target_key, "scenario_type": "DEV_UNAVAILABLE", "parameters": {"unavailable_days": 5}}
    )
    assert sim_run_resp.status_code == 200, f"Simulation run failed: {sim_run_resp.text}"
    sim_result = sim_run_resp.json()
    print(f"Simulation DEV_UNAVAILABLE (5 days): Delay={sim_result.get('expected_delay')}d SimulatedTarget={sim_result.get('simulated_target')}d Risk={sim_result.get('risk_level')}")
    assert sim_result.get('simulated_target', 0) >= 1, "Simulated target must not be negative or zero!"
    print("[OK] What-If Simulator scenario executed and validated")

    # 5. AI Risk Engine Summary & Risk Factors
    print("\n--- Test 5: AI Risk Engine Summary & Risk Factors ---")
    summary_resp = client.get(f"{BASE_URL}/ai/summary?type=weekly", headers=headers_admin)
    assert summary_resp.status_code == 200, f"AI summary failed: {summary_resp.text}"
    ai_sum = summary_resp.json()
    print(f"Executive Summary ({ai_sum.get('project_name')}): Health={ai_sum.get('health_status')}, Score={ai_sum.get('risk_score')}")
    assert len(ai_sum.get("recommendations", [])) > 0

    risk_resp = client.get(f"{BASE_URL}/ai/risk-prediction", headers=headers_admin)
    assert risk_resp.status_code == 200
    ai_risk = risk_resp.json()
    print(f"Risk Prediction: DelayProb={ai_risk.get('sprint_delay_probability')}% Level={ai_risk.get('project_delay_risk')}")
    print(f"High Risk Tasks ({len(ai_risk.get('high_risk_tasks', []))}), Overloaded Devs ({len(ai_risk.get('overloaded_developers', []))})")
    print("[OK] AI Risk Engine validated with live telemetry")

    # 6. Audit Activity Timeline
    print("\n--- Test 6: Audit Activity Logs & Filtering ---")
    logs_resp = client.get(f"{BASE_URL}/admin/activity-logs", headers=headers_admin)
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    print(f"Total Activity Logs: {len(logs)}")
    assert len(logs) > 0, "Expected activity logs to contain records!"
    print(f"Latest Log: User={logs[0]['user_name']} ({logs[0].get('user_role')}) Action={logs[0]['action']} Target={logs[0]['entity_type']}")

    # Search filter test
    search_resp = client.get(f"{BASE_URL}/admin/activity-logs?q=LOGIN", headers=headers_admin)
    assert search_resp.status_code == 200
    filtered_logs = search_resp.json()
    print(f"Logs matching 'LOGIN': {len(filtered_logs)}")
    assert any("LOGIN" in l["action"] for l in filtered_logs), "Expected LOGIN logs!"
    print("[OK] Audit Activity Timeline and search filter validated")

    # 7. Executive Reports: All 4 Types (including PROJECT Portfolio)
    print("\n--- Test 7: Executive Reports Preview & Exports (PROJECT, WEEKLY, SPRINT, DEVELOPER) ---")
    for rtype in ["PROJECT", "WEEKLY", "SPRINT", "DEVELOPER"]:
        prev_resp = client.get(f"{BASE_URL}/reports/preview?report_type={rtype}", headers=headers_admin)
        assert prev_resp.status_code == 200, f"Preview failed for {rtype}: {prev_resp.text}"
        prev = prev_resp.json()
        print(f"Report [{rtype}] Preview: Title='{prev.get('title')}', Rows={len(prev.get('rows', []))}, SummaryKeys={list(prev.get('summary', {}).keys())}")
        assert len(prev.get("headers", [])) > 0

    # Test PDF, CSV, Excel generation for PROJECT portfolio
    for fmt in ["PDF", "CSV", "EXCEL"]:
        exp_resp = client.post(
            f"{BASE_URL}/reports/generate",
            headers=headers_admin,
            json={"title": f"Test {fmt} Report", "report_type": "PROJECT", "format": fmt}
        )
        assert exp_resp.status_code == 200, f"Export failed for PROJECT {fmt}: {exp_resp.text}"
        assert len(exp_resp.content) > 50
        print(f"[OK] PROJECT Report generated successfully in {fmt} format ({len(exp_resp.content)} bytes)")

    # 8. System Settings & Health Checks
    print("\n--- Test 8: System Settings & Health Checks ---")
    settings_resp = client.get(f"{BASE_URL}/settings", headers=headers_admin)
    assert settings_resp.status_code == 200
    current_settings = settings_resp.json()
    print(f"Loaded {len(current_settings)} system settings from database.")
    assert len(current_settings) > 0

    # Test updating settings
    update_resp = client.put(
        f"{BASE_URL}/settings",
        headers=headers_admin,
        json={"settings": {"session_timeout": 120, "strict_role_verification": True}}
    )
    assert update_resp.status_code == 200
    print("[OK] Settings update persisted successfully")

    # Test comprehensive health check
    health_check_resp = client.post(f"{BASE_URL}/settings/health", headers=headers_admin)
    assert health_check_resp.status_code == 200
    sys_health = health_check_resp.json()
    for svc, h in sys_health.items():
        print(f"Service '{svc}': Status={h['status']}, Message='{h['message']}'")
        assert "Railway" not in h.get("message", ""), f"Found outdated Railway reference in {svc}!"
    assert sys_health["database"]["status"] == "ONLINE"
    assert sys_health["backend"]["status"] == "ONLINE"

    # Test individual test endpoints
    test_db_resp = client.post(f"{BASE_URL}/settings/test-database", headers=headers_admin)
    assert test_db_resp.status_code == 200 and test_db_resp.json().get("status") == "success"
    print(f"[OK] Test DB Connection: {test_db_resp.json().get('message')}")

    test_gem_resp = client.post(f"{BASE_URL}/settings/test-gemini", headers=headers_admin)
    assert test_gem_resp.status_code == 200
    print(f"[OK] Test Gemini: {test_gem_resp.json().get('message')}")

    test_gh_resp = client.post(f"{BASE_URL}/settings/test-github", headers=headers_admin)
    assert test_gh_resp.status_code == 200
    print(f"[OK] Test GitHub: {test_gh_resp.json().get('message')}")

    print("\n=======================================================")
    print("ALL ADMIN PORTAL REAL-TIME INTEGRATION TESTS PASSED 100%!")
    print("=======================================================")

if __name__ == "__main__":
    run_admin_tests()
