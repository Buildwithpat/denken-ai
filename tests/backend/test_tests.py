"""
Smoke tests for /api/test endpoints.

  syllabus (public)  →  generate (auth)  →  submit (auth)
"""
import pytest

pytestmark = pytest.mark.backend

from fixtures.seed_data import DEMO_GENERATE_REQUESTS


# ---------------------------------------------------------------------------
# Syllabus — public endpoint
# ---------------------------------------------------------------------------

class TestSyllabus:
    def test_syllabus_jee_main(self, raw_client):
        resp = raw_client.get("/api/test/syllabus", params={"exam": "JEE_MAIN"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["exam"] == "JEE_MAIN"
        assert isinstance(body["subjects"], list)
        assert len(body["subjects"]) > 0

    def test_syllabus_neet(self, raw_client):
        resp = raw_client.get("/api/test/syllabus", params={"exam": "NEET"})
        assert resp.status_code == 200
        assert resp.json()["exam"] == "NEET"

    def test_syllabus_cbse_with_class(self, raw_client):
        resp = raw_client.get(
            "/api/test/syllabus",
            params={"exam": "CBSE", "cbseClass": "11"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["cbseClass"] == "11"

    def test_syllabus_invalid_exam(self, raw_client):
        resp = raw_client.get("/api/test/syllabus", params={"exam": "FAKE_EXAM"})
        assert resp.status_code in (400, 422)

    def test_syllabus_missing_exam(self, raw_client):
        resp = raw_client.get("/api/test/syllabus")
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Generate — requires auth
# ---------------------------------------------------------------------------

class TestGenerate:
    def test_generate_returns_201_with_questions(self, client):
        req = DEMO_GENERATE_REQUESTS[0]
        resp = client.post("/api/test/generate", json=req)
        assert resp.status_code == 201
        body = resp.json()
        assert "testId" in body
        assert isinstance(body["testId"], str)
        assert "questions" in body
        assert len(body["questions"]) == req["questionCount"]

    def test_generate_question_shape(self, client):
        req = {**DEMO_GENERATE_REQUESTS[0], "questionCount": 5}
        resp = client.post("/api/test/generate", json=req)
        assert resp.status_code == 201
        q = resp.json()["questions"][0]
        for field in ("id", "subject", "topic", "difficulty", "type", "question", "marks"):
            assert field in q, f"Missing field: {field}"
        if q["type"] == "mcq":
            assert "options" in q
            assert len(q["options"]) == 4
            assert q.get("correctOption") in ("A", "B", "C", "D")
        else:
            assert "answer" in q

    def test_generate_neet(self, client):
        resp = client.post("/api/test/generate", json=DEMO_GENERATE_REQUESTS[1])
        assert resp.status_code == 201
        assert resp.json()["exam"] == "NEET"

    def test_generate_cbse(self, client):
        resp = client.post("/api/test/generate", json=DEMO_GENERATE_REQUESTS[2])
        assert resp.status_code == 201
        assert resp.json()["exam"] == "CBSE"

    def test_generate_respects_marking(self, client):
        resp = client.post("/api/test/generate", json=DEMO_GENERATE_REQUESTS[0])
        body = resp.json()
        assert body["marking"]["correct"] == 4
        assert body["marking"]["wrong"] == -1

    def test_generate_requires_auth(self, raw_client):
        resp = raw_client.post("/api/test/generate", json=DEMO_GENERATE_REQUESTS[0])
        assert resp.status_code == 401

    def test_generate_invalid_exam_400(self, client):
        resp = client.post(
            "/api/test/generate",
            json={"exam": "BAD", "subjects": ["Physics"]},
        )
        assert resp.status_code == 400

    def test_generate_empty_subjects_400(self, client):
        resp = client.post(
            "/api/test/generate",
            json={"exam": "JEE_MAIN", "subjects": []},
        )
        assert resp.status_code == 400

    def test_generate_invalid_difficulty_400(self, client):
        resp = client.post(
            "/api/test/generate",
            json={"exam": "JEE_MAIN", "subjects": ["Physics"], "difficulty": "ultra"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Submit — requires auth
# ---------------------------------------------------------------------------

class TestSubmit:
    def test_submit_all_correct(self, client, generated_test):
        """Submit all correct answers; score should equal questions × correct mark."""
        questions = generated_test["questions"]
        answers = []
        for q in questions:
            ans: dict = {"questionId": q["id"]}
            if q["type"] == "mcq":
                ans["selectedOption"] = q["correctOption"]
            else:
                ans["numericalValue"] = q["answer"]
            answers.append(ans)

        resp = client.post(
            "/api/test/submit",
            json={
                "testId":    generated_test["testId"],
                "timeTaken": 300,
                "answers":   answers,
            },
        )
        assert resp.status_code == 201
        result = resp.json()["result"]
        assert result["correctCount"] == len(questions)
        assert result["wrongCount"]   == 0
        assert result["totalScore"]   == len(questions) * generated_test["marking"]["correct"]

    def test_submit_all_unanswered(self, client):
        """Submit with no answers; score should be 0 with no wrong-answer penalty."""
        # Generate a fresh small test
        req = {"exam": "JEE_MAIN", "subjects": ["Physics"], "questionCount": 5}
        gen_resp = client.post("/api/test/generate", json=req)
        assert gen_resp.status_code == 201
        test_body = gen_resp.json()

        resp = client.post(
            "/api/test/submit",
            json={"testId": test_body["testId"], "timeTaken": 0, "answers": []},
        )
        assert resp.status_code == 201
        result = resp.json()["result"]
        assert result["totalScore"]      == 0
        assert result["correctCount"]    == 0
        assert result["wrongCount"]      == 0
        assert result["unattemptedCount"] == len(test_body["questions"])

    def test_submit_result_shape(self, client, submitted_result):
        for field in (
            "id", "testId", "totalScore", "correctCount",
            "wrongCount", "unattemptedCount", "accuracy", "timeTaken",
        ):
            assert field in submitted_result, f"Missing field: {field}"
        assert 0.0 <= submitted_result["accuracy"] <= 100.0

    def test_submit_requires_auth(self, raw_client, generated_test):
        resp = raw_client.post(
            "/api/test/submit",
            json={"testId": generated_test["testId"], "timeTaken": 0, "answers": []},
        )
        assert resp.status_code == 401

    def test_submit_invalid_test_id(self, client):
        resp = client.post(
            "/api/test/submit",
            json={"testId": "000000000000000000000000", "timeTaken": 0, "answers": []},
        )
        assert resp.status_code in (400, 403, 404)

    def test_submit_bad_test_id_format(self, client):
        resp = client.post(
            "/api/test/submit",
            json={"testId": "not-an-object-id", "timeTaken": 0, "answers": []},
        )
        assert resp.status_code in (400, 422)
