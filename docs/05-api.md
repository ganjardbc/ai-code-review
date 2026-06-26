# API Documentation

The AI Code Reviewer service exposes REST endpoints for webhook integration and health monitoring.

---

## 1. Webhook Handlers

### GitHub Webhook

Handles incoming events sent by GitHub Webhooks.

* **Endpoint**: `/webhooks/github`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `X-GitHub-Event: pull_request`
  * `X-Hub-Signature-256: sha256=<hmac-signature>`
* **Request Payload (Truncated GitHub Schema)**:
  ```json
  {
    "action": "opened",
    "number": 12,
    "pull_request": {
      "head": {
        "ref": "feature-auth-fix",
        "sha": "a8f3b2d1c0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5"
      },
      "base": {
        "ref": "main"
      }
    },
    "repository": {
      "name": "backend-service",
      "owner": {
        "login": "my-organization"
      },
      "clone_url": "https://github.com/my-organization/backend-service.git"
    }
  }
  ```

#### Response

* **Status Code**: `202 Accepted`
* **Body**:
  ```json
  {
    "status": "enqueued",
    "jobId": "git-1798319-aba2-4bf2-a39c"
  }
  ```

---

### GitLab Webhook

Handles incoming events sent by GitLab Webhooks.

* **Endpoint**: `/webhooks/gitlab`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `X-Gitlab-Token: <webhook-secret-token>`
  * `X-Gitlab-Event: Merge Request Hook`
* **Request Payload (Truncated GitLab Schema)**:
  ```json
  {
    "object_kind": "merge_request",
    "object_attributes": {
      "action": "open",
      "iid": 45,
      "source_branch": "bugfix-db-leak",
      "target_branch": "develop",
      "last_commit": {
        "id": "7b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c"
      },
      "target": {
        "git_http_url": "https://gitlab.com/my-organization/core-api.git"
      }
    },
    "project": {
      "id": 847291
    }
  }
  ```

#### Response

* **Status Code**: `202 Accepted`
* **Body**:
  ```json
  {
    "status": "enqueued",
    "jobId": "gitlab-9281729-ff8a-4c28-98e3"
  }
  ```

---

## 2. Health Monitoring

### Health Check

Determines the health status of the API instance and its dependencies (e.g. Redis).

* **Endpoint**: `/health`
* **Method**: `GET`
* **Response (Healthy)**:
  * **Status Code**: `200 OK`
  * **Body**:
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-06-26T15:10:00.000Z",
      "services": {
        "redis": "up",
        "disk": "up"
      }
    }
    ```
* **Response (Unhealthy)**:
  * **Status Code**: `503 Service Unavailable`
  * **Body**:
    ```json
    {
      "status": "unhealthy",
      "timestamp": "2026-06-26T15:10:00.000Z",
      "services": {
        "redis": "down",
        "disk": "up"
      }
    }
    ```

---

## Error Handling Scenarios

The API follows semantic HTTP status standards:

| Status Code | Reason | Example JSON Payload Response |
|---|---|---|
| `400 Bad Request` | Missing or invalid request parameters or body. | `{"statusCode": 400, "error": "Bad Request", "message": "body should have required property 'repository'"}` |
| `401 Unauthorized` | Invalid Webhook signature or missing credentials. | `{"statusCode": 401, "error": "Unauthorized", "message": "Invalid webhook token or signature mismatch."}` |
| `405 Method Not Allowed` | Calling endpoints using unsupported HTTP verbs. | `{"statusCode": 405, "error": "Method Not Allowed", "message": "Route GET:/webhooks/github not found"}` |
| `500 Internal Server Error` | Unexpected server crash or unhandled runtime failure. | `{"statusCode": 500, "error": "Internal Server Error", "message": "An unexpected error occurred."}` |
