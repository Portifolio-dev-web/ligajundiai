#!/usr/bin/env python3
"""
Comprehensive E2E Backend API Test for Liga de Voleibol Jundiaí (LVJ)
Tests all endpoints with proper authentication flow
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://volley-jundiai.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@lvj.com"
ADMIN_PASSWORD = "admin123"

# Test state
admin_token = None
gestor1_token = None
gestor2_token = None
gestor3_token = None
team_a_id = None
team_b_id = None
team_c_id = None
athlete_id = None
match_id = None

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    return passed

def test_auth_login_password():
    """Test 1: Admin login with password"""
    global admin_token
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login-password",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "token" in data and data.get("user", {}).get("role") == "admin":
            admin_token = data["token"]
            return log_test("Auth: Admin login with password", True, f"Token received, role={data['user']['role']}")
        else:
            return log_test("Auth: Admin login with password", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: Admin login with password", False, f"Exception: {str(e)}")

def test_auth_register_gestor1():
    """Test 2: Register gestor 1"""
    global gestor1_token
    try:
        email = f"gestor1_{datetime.now().timestamp()}@test.com"
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "name": "Gestor Team A",
                "email": email,
                "phone": "11987654321",
                "cpf": "12345678901",
                "password": "gestor123"
            },
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "token" in data and data.get("user", {}).get("role") == "gestor":
            gestor1_token = data["token"]
            return log_test("Auth: Register gestor 1", True, f"Token received, role={data['user']['role']}")
        else:
            return log_test("Auth: Register gestor 1", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: Register gestor 1", False, f"Exception: {str(e)}")

def test_auth_otp_request():
    """Test 3: OTP request"""
    global otp_code, otp_email
    try:
        otp_email = f"otpuser_{datetime.now().timestamp()}@test.com"
        response = requests.post(
            f"{BASE_URL}/auth/otp/request",
            json={"email": otp_email},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("ok") and "dev_code" in data:
            otp_code = data["dev_code"]
            return log_test("Auth: OTP request", True, f"OTP code received: {otp_code}")
        else:
            return log_test("Auth: OTP request", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: OTP request", False, f"Exception: {str(e)}")

def test_auth_otp_verify():
    """Test 4: OTP verify"""
    global otp_token
    try:
        response = requests.post(
            f"{BASE_URL}/auth/otp/verify",
            json={"email": otp_email, "code": otp_code},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "token" in data and "user" in data:
            otp_token = data["token"]
            return log_test("Auth: OTP verify", True, f"Token received for {data['user'].get('email')}")
        else:
            return log_test("Auth: OTP verify", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: OTP verify", False, f"Exception: {str(e)}")

def test_auth_me():
    """Test 5: GET /auth/me with gestor token"""
    try:
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {gestor1_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "user" in data:
            team_status = "null" if data.get("team") is None else "exists"
            return log_test("Auth: GET /auth/me", True, f"User retrieved, team={team_status}")
        else:
            return log_test("Auth: GET /auth/me", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: GET /auth/me", False, f"Exception: {str(e)}")

def test_auth_logout():
    """Test 6: Logout"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {otp_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("ok"):
            return log_test("Auth: Logout", True, "Logout successful")
        else:
            return log_test("Auth: Logout", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Auth: Logout", False, f"Exception: {str(e)}")

def test_rules_get():
    """Test 7: GET /rules (public)"""
    try:
        response = requests.get(f"{BASE_URL}/rules", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and "rules" in data:
            rules = data["rules"]
            has_points = "points" in rules
            has_tiebreakers = "tiebreakers" in rules
            has_attendance = "min_attendance_percent" in rules
            return log_test("Rules: GET /rules", True, f"Rules retrieved: points={has_points}, tiebreakers={has_tiebreakers}, attendance={has_attendance}")
        else:
            return log_test("Rules: GET /rules", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Rules: GET /rules", False, f"Exception: {str(e)}")

def test_rules_put_no_token():
    """Test 8: PUT /rules without token (expect 401)"""
    try:
        response = requests.put(
            f"{BASE_URL}/rules",
            json={"points": {"win_3_0": 3}},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 401:
            return log_test("Rules: PUT /rules without token", True, "Correctly returned 401")
        else:
            return log_test("Rules: PUT /rules without token", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        return log_test("Rules: PUT /rules without token", False, f"Exception: {str(e)}")

def test_rules_put_gestor_token():
    """Test 9: PUT /rules with gestor token (expect 403)"""
    try:
        response = requests.put(
            f"{BASE_URL}/rules",
            json={"points": {"win_3_0": 3}},
            headers={"Authorization": f"Bearer {gestor1_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 403:
            return log_test("Rules: PUT /rules with gestor token", True, "Correctly returned 403")
        else:
            return log_test("Rules: PUT /rules with gestor token", False, f"Expected 403, got {response.status_code}")
    except Exception as e:
        return log_test("Rules: PUT /rules with gestor token", False, f"Exception: {str(e)}")

def test_rules_put_admin():
    """Test 10: PUT /rules with admin token"""
    try:
        response = requests.put(
            f"{BASE_URL}/rules",
            json={
                "points": {
                    "win_3_0": 3,
                    "win_3_1": 3,
                    "win_3_2": 2,
                    "loss_3_2": 1,
                    "loss_3_1": 0,
                    "loss_3_0": 0
                },
                "tiebreakers": ["points", "wins", "sets_ratio", "points_ratio"],
                "min_attendance_percent": 60
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("rules", {}).get("min_attendance_percent") == 60:
            return log_test("Rules: PUT /rules with admin", True, "Rules updated successfully")
        else:
            return log_test("Rules: PUT /rules with admin", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Rules: PUT /rules with admin", False, f"Exception: {str(e)}")

def test_create_team_a():
    """Test 11: Create Team A (gestor 1)"""
    global team_a_id
    try:
        response = requests.post(
            f"{BASE_URL}/teams",
            json={"name": "Team A", "category": "Adulto Masculino"},
            headers={"Authorization": f"Bearer {gestor1_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "team" in data:
            team_a_id = data["team"]["id"]
            status = data["team"].get("status")
            return log_test("Approval: Create Team A", True, f"Team created with status={status}, id={team_a_id}")
        else:
            return log_test("Approval: Create Team A", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Create Team A", False, f"Exception: {str(e)}")

def test_create_team_b():
    """Test 12: Register gestor 2 and create Team B"""
    global gestor2_token, team_b_id
    try:
        # Register gestor 2
        email = f"gestor2_{datetime.now().timestamp()}@test.com"
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "name": "Gestor Team B",
                "email": email,
                "phone": "11987654322",
                "cpf": "12345678902",
                "password": "gestor123"
            },
            timeout=10
        )
        data = response.json()
        
        if response.status_code != 200 or "token" not in data:
            return log_test("Approval: Register gestor 2 & create Team B", False, f"Failed to register gestor 2: {data}")
        
        gestor2_token = data["token"]
        
        # Create Team B
        response = requests.post(
            f"{BASE_URL}/teams",
            json={"name": "Team B", "category": "Adulto Masculino"},
            headers={"Authorization": f"Bearer {gestor2_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "team" in data:
            team_b_id = data["team"]["id"]
            return log_test("Approval: Register gestor 2 & create Team B", True, f"Team B created, id={team_b_id}")
        else:
            return log_test("Approval: Register gestor 2 & create Team B", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Register gestor 2 & create Team B", False, f"Exception: {str(e)}")

def test_admin_get_pending_teams():
    """Test 13: Admin GET pending teams"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/teams?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "teams" in data:
            count = len(data["teams"])
            return log_test("Approval: Admin GET pending teams", True, f"Found {count} pending teams")
        else:
            return log_test("Approval: Admin GET pending teams", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin GET pending teams", False, f"Exception: {str(e)}")

def test_admin_approve_team_a():
    """Test 14: Admin approve Team A"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/teams/{team_a_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("team", {}).get("status") == "approved" and data.get("email_sent_mock"):
            return log_test("Approval: Admin approve Team A", True, "Team A approved, email_sent_mock=true")
        else:
            return log_test("Approval: Admin approve Team A", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin approve Team A", False, f"Exception: {str(e)}")

def test_admin_approve_team_b():
    """Test 15: Admin approve Team B"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/teams/{team_b_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("team", {}).get("status") == "approved":
            return log_test("Approval: Admin approve Team B", True, "Team B approved")
        else:
            return log_test("Approval: Admin approve Team B", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin approve Team B", False, f"Exception: {str(e)}")

def test_create_athlete():
    """Test 16: Gestor A creates athlete (team approved)"""
    global athlete_id
    try:
        response = requests.post(
            f"{BASE_URL}/athletes",
            json={
                "name": "Atleta 1",
                "cpf": "11122233344",
                "position": "Levantador",
                "birthdate": "1995-05-15"
            },
            headers={"Authorization": f"Bearer {gestor1_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "athlete" in data:
            athlete_id = data["athlete"]["id"]
            status = data["athlete"].get("status")
            return log_test("Approval: Gestor A creates athlete", True, f"Athlete created with status={status}, id={athlete_id}")
        else:
            return log_test("Approval: Gestor A creates athlete", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Gestor A creates athlete", False, f"Exception: {str(e)}")

def test_create_athlete_unapproved_team():
    """Test 17: Verify gestor with unapproved team cannot add athlete"""
    global gestor3_token, team_c_id
    try:
        # Register gestor 3
        email = f"gestor3_{datetime.now().timestamp()}@test.com"
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "name": "Gestor Team C",
                "email": email,
                "phone": "11987654323",
                "cpf": "12345678903",
                "password": "gestor123"
            },
            timeout=10
        )
        data = response.json()
        
        if response.status_code != 200 or "token" not in data:
            return log_test("Approval: Verify unapproved team cannot add athlete", False, f"Failed to register gestor 3: {data}")
        
        gestor3_token = data["token"]
        
        # Create Team C (will be pending)
        response = requests.post(
            f"{BASE_URL}/teams",
            json={"name": "Team C", "category": "Adulto Feminino"},
            headers={"Authorization": f"Bearer {gestor3_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code != 200 or "team" not in data:
            return log_test("Approval: Verify unapproved team cannot add athlete", False, f"Failed to create Team C: {data}")
        
        team_c_id = data["team"]["id"]
        
        # Try to add athlete (should fail with 400)
        response = requests.post(
            f"{BASE_URL}/athletes",
            json={
                "name": "Atleta Rejected",
                "cpf": "99988877766",
                "position": "Ponteiro"
            },
            headers={"Authorization": f"Bearer {gestor3_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 400:
            return log_test("Approval: Verify unapproved team cannot add athlete", True, "Correctly returned 400 for unapproved team")
        else:
            return log_test("Approval: Verify unapproved team cannot add athlete", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        return log_test("Approval: Verify unapproved team cannot add athlete", False, f"Exception: {str(e)}")

def test_admin_get_pending_athletes():
    """Test 18: Admin GET pending athletes"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/athletes?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "athletes" in data:
            count = len(data["athletes"])
            return log_test("Approval: Admin GET pending athletes", True, f"Found {count} pending athletes")
        else:
            return log_test("Approval: Admin GET pending athletes", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin GET pending athletes", False, f"Exception: {str(e)}")

def test_admin_approve_athlete():
    """Test 19: Admin approve athlete"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/athletes/{athlete_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("athlete", {}).get("status") == "approved" and data.get("email_sent_mock"):
            return log_test("Approval: Admin approve athlete", True, "Athlete approved, email_sent_mock=true")
        else:
            return log_test("Approval: Admin approve athlete", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin approve athlete", False, f"Exception: {str(e)}")

def test_admin_create_match():
    """Test 20: Admin create match"""
    global match_id
    try:
        scheduled_at = (datetime.now() + timedelta(days=7)).isoformat()
        response = requests.post(
            f"{BASE_URL}/admin/matches",
            json={
                "home_team_id": team_a_id,
                "away_team_id": team_b_id,
                "scheduled_at": scheduled_at,
                "venue": "Ginásio Municipal",
                "round": "Rodada 1"
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "match" in data:
            match_id = data["match"]["id"]
            return log_test("Approval: Admin create match", True, f"Match created, id={match_id}")
        else:
            return log_test("Approval: Admin create match", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin create match", False, f"Exception: {str(e)}")

def test_admin_register_match_result():
    """Test 21: Admin register match result (3x0)"""
    try:
        response = requests.put(
            f"{BASE_URL}/admin/matches/{match_id}/result",
            json={
                "sets": [
                    {"home": 25, "away": 20},
                    {"home": 25, "away": 18},
                    {"home": 25, "away": 22}
                ]
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("match", {}).get("status") == "finished":
            return log_test("Approval: Admin register match result", True, "Match result registered, status=finished")
        else:
            return log_test("Approval: Admin register match result", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Approval: Admin register match result", False, f"Exception: {str(e)}")

def test_get_standings():
    """Test 22: GET /standings for Adulto Masculino"""
    try:
        response = requests.get(
            f"{BASE_URL}/standings?category=Adulto%20Masculino",
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "standings" in data:
            standings = data["standings"]
            if len(standings) >= 2:
                team_a = next((t for t in standings if t.get("name") == "Team A"), None)
                team_b = next((t for t in standings if t.get("name") == "Team B"), None)
                
                if team_a and team_b:
                    team_a_points = team_a.get("points", 0)
                    team_b_points = team_b.get("points", 0)
                    team_a_position = team_a.get("position", 0)
                    
                    # Team A should have 3 points (win_3_0), Team B should have 0 points (loss_3_0)
                    if team_a_points == 3 and team_b_points == 0 and team_a_position == 1:
                        return log_test("Standings: GET /standings", True, f"Team A: position={team_a_position}, points={team_a_points}; Team B: points={team_b_points}")
                    else:
                        return log_test("Standings: GET /standings", False, f"Unexpected points: Team A={team_a_points} (expected 3), Team B={team_b_points} (expected 0)")
                else:
                    return log_test("Standings: GET /standings", False, "Team A or Team B not found in standings")
            else:
                return log_test("Standings: GET /standings", False, f"Expected at least 2 teams, got {len(standings)}")
        else:
            return log_test("Standings: GET /standings", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Standings: GET /standings", False, f"Exception: {str(e)}")

def test_admin_notifications():
    """Test 23: GET /admin/notifications"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/notifications",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200:
            pending_teams = data.get("pending_teams", 0)
            pending_athletes = data.get("pending_athletes", 0)
            items = data.get("items", [])
            
            # Check if we have team_pending and athlete_pending notifications
            has_team_pending = any(item.get("type") == "team_pending" for item in items)
            has_athlete_pending = any(item.get("type") == "athlete_pending" for item in items)
            
            return log_test("Notifications: GET /admin/notifications", True, 
                          f"pending_teams={pending_teams}, pending_athletes={pending_athletes}, items={len(items)}, has_team_pending={has_team_pending}, has_athlete_pending={has_athlete_pending}")
        else:
            return log_test("Notifications: GET /admin/notifications", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Notifications: GET /admin/notifications", False, f"Exception: {str(e)}")

def test_admin_notifications_read_all():
    """Test 24: POST /admin/notifications/read-all"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/notifications/read-all",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("ok"):
            return log_test("Notifications: POST /admin/notifications/read-all", True, "All notifications marked as read")
        else:
            return log_test("Notifications: POST /admin/notifications/read-all", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Notifications: POST /admin/notifications/read-all", False, f"Exception: {str(e)}")

def test_admin_post_attendance():
    """Test 25: POST /admin/attendance"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/attendance",
            json={
                "team_id": team_a_id,
                "date": "2025-06-01",
                "records": [
                    {"athlete_id": athlete_id, "present": True}
                ]
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("ok"):
            return log_test("Attendance: POST /admin/attendance", True, "Attendance registered")
        else:
            return log_test("Attendance: POST /admin/attendance", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Attendance: POST /admin/attendance", False, f"Exception: {str(e)}")

def test_admin_get_attendance():
    """Test 26: GET /admin/attendance"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/attendance?team_id={team_a_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "attendance" in data:
            attendance = data["attendance"]
            if len(attendance) > 0:
                athlete_att = attendance[0]
                percent = athlete_att.get("percent", 0)
                eligible = athlete_att.get("eligible")
                return log_test("Attendance: GET /admin/attendance", True, 
                              f"Attendance retrieved: percent={percent}%, eligible={eligible}")
            else:
                return log_test("Attendance: GET /admin/attendance", False, "No attendance records found")
        else:
            return log_test("Attendance: GET /admin/attendance", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Attendance: GET /admin/attendance", False, f"Exception: {str(e)}")

def test_gestor_get_attendance_mine():
    """Test 27: GET /attendance/mine (gestor)"""
    try:
        response = requests.get(
            f"{BASE_URL}/attendance/mine",
            headers={"Authorization": f"Bearer {gestor1_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "attendance" in data:
            attendance = data["attendance"]
            return log_test("Attendance: GET /attendance/mine", True, f"Gestor attendance retrieved: {len(attendance)} records")
        else:
            return log_test("Attendance: GET /attendance/mine", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Attendance: GET /attendance/mine", False, f"Exception: {str(e)}")

def test_admin_reject_team():
    """Test 28: Admin reject Team C"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/teams/{team_c_id}/reject",
            json={"justification": "Documentos incompletos"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and data.get("team", {}).get("status") == "rejected":
            justification = data["team"].get("justification", "")
            return log_test("Reject: Admin reject Team C", True, f"Team rejected with justification: {justification}")
        else:
            return log_test("Reject: Admin reject Team C", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Reject: Admin reject Team C", False, f"Exception: {str(e)}")

def test_admin_get_emails():
    """Test 29: GET /admin/emails (verify MOCKED emails)"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/emails",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200 and "emails" in data:
            emails = data["emails"]
            
            # Check for different email types
            has_otp = any(e.get("type") == "otp_login" for e in emails)
            has_team_approve = any(e.get("type") == "team_approve" for e in emails)
            has_team_reject = any(e.get("type") == "team_reject" for e in emails)
            has_athlete_approve = any(e.get("type") == "athlete_approve" for e in emails)
            
            return log_test("Emails: GET /admin/emails", True, 
                          f"Found {len(emails)} emails: otp={has_otp}, team_approve={has_team_approve}, team_reject={has_team_reject}, athlete_approve={has_athlete_approve}")
        else:
            return log_test("Emails: GET /admin/emails", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Emails: GET /admin/emails", False, f"Exception: {str(e)}")

def test_public_categories():
    """Test 30: GET /categories (public)"""
    try:
        response = requests.get(f"{BASE_URL}/categories", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and "categories" in data:
            categories = data["categories"]
            return log_test("Public: GET /categories", True, f"Retrieved {len(categories)} categories")
        else:
            return log_test("Public: GET /categories", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Public: GET /categories", False, f"Exception: {str(e)}")

def test_public_sponsors():
    """Test 31: GET /sponsors (public)"""
    try:
        response = requests.get(f"{BASE_URL}/sponsors", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and "sponsors" in data:
            sponsors = data["sponsors"]
            return log_test("Public: GET /sponsors", True, f"Retrieved {len(sponsors)} sponsors")
        else:
            return log_test("Public: GET /sponsors", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Public: GET /sponsors", False, f"Exception: {str(e)}")

def test_public_matches():
    """Test 32: GET /matches (public)"""
    try:
        response = requests.get(f"{BASE_URL}/matches", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and "matches" in data:
            matches = data["matches"]
            return log_test("Public: GET /matches", True, f"Retrieved {len(matches)} matches")
        else:
            return log_test("Public: GET /matches", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Public: GET /matches", False, f"Exception: {str(e)}")

def test_admin_stats_with_token():
    """Test 33: GET /admin/stats with admin token"""
    try:
        response = requests.get(
            f"{BASE_URL}/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        data = response.json()
        
        if response.status_code == 200:
            teams = data.get("teams", 0)
            athletes = data.get("athletes", 0)
            matches = data.get("matches", 0)
            return log_test("Protection: GET /admin/stats with token", True, 
                          f"Stats retrieved: teams={teams}, athletes={athletes}, matches={matches}")
        else:
            return log_test("Protection: GET /admin/stats with token", False, f"Status={response.status_code}, Response={data}")
    except Exception as e:
        return log_test("Protection: GET /admin/stats with token", False, f"Exception: {str(e)}")

def test_admin_stats_without_token():
    """Test 34: GET /admin/stats without token (expect 401)"""
    try:
        response = requests.get(f"{BASE_URL}/admin/stats", timeout=10)
        data = response.json()
        
        if response.status_code == 401:
            return log_test("Protection: GET /admin/stats without token", True, "Correctly returned 401")
        else:
            return log_test("Protection: GET /admin/stats without token", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        return log_test("Protection: GET /admin/stats without token", False, f"Exception: {str(e)}")

def main():
    """Run all tests in sequence"""
    print("=" * 80)
    print("LVJ Backend API E2E Test Suite")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("=" * 80)
    
    results = []
    
    # Auth tests
    print("\n" + "=" * 80)
    print("1. AUTHENTICATION TESTS")
    print("=" * 80)
    results.append(test_auth_login_password())
    results.append(test_auth_register_gestor1())
    results.append(test_auth_otp_request())
    results.append(test_auth_otp_verify())
    results.append(test_auth_me())
    results.append(test_auth_logout())
    
    # Rules tests
    print("\n" + "=" * 80)
    print("2. RULES ENGINE TESTS")
    print("=" * 80)
    results.append(test_rules_get())
    results.append(test_rules_put_no_token())
    results.append(test_rules_put_gestor_token())
    results.append(test_rules_put_admin())
    
    # Approval flow tests
    print("\n" + "=" * 80)
    print("3. APPROVAL FLOW + STANDINGS E2E")
    print("=" * 80)
    results.append(test_create_team_a())
    results.append(test_create_team_b())
    results.append(test_admin_get_pending_teams())
    results.append(test_admin_approve_team_a())
    results.append(test_admin_approve_team_b())
    results.append(test_create_athlete())
    results.append(test_create_athlete_unapproved_team())
    results.append(test_admin_get_pending_athletes())
    results.append(test_admin_approve_athlete())
    results.append(test_admin_create_match())
    results.append(test_admin_register_match_result())
    results.append(test_get_standings())
    
    # Notifications tests
    print("\n" + "=" * 80)
    print("4. NOTIFICATIONS (SINO)")
    print("=" * 80)
    results.append(test_admin_notifications())
    results.append(test_admin_notifications_read_all())
    
    # Attendance tests
    print("\n" + "=" * 80)
    print("5. ATTENDANCE")
    print("=" * 80)
    results.append(test_admin_post_attendance())
    results.append(test_admin_get_attendance())
    results.append(test_gestor_get_attendance_mine())
    
    # Reject flow tests
    print("\n" + "=" * 80)
    print("6. REJECT FLOW")
    print("=" * 80)
    results.append(test_admin_reject_team())
    results.append(test_admin_get_emails())
    
    # Public + protection tests
    print("\n" + "=" * 80)
    print("7. PUBLIC + PROTECTION")
    print("=" * 80)
    results.append(test_public_categories())
    results.append(test_public_sponsors())
    results.append(test_public_matches())
    results.append(test_admin_stats_with_token())
    results.append(test_admin_stats_without_token())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    failed = total - passed
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n⚠️  Some tests failed. Please review the details above.")
        sys.exit(1)
    else:
        print("\n🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
