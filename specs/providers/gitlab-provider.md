# GitLab Provider Specification

## Purpose
Expose GitLab integration API adapters.

## Responsibilities
* Post inline discussion comments to GitLab merge requests.

## Dependencies
* External: `@gitbeaker/rest`.
* Internal: `IScmProvider`.

## Public Interfaces
* Implements `IScmProvider` port interface.

* **API Endpoints Called**:
  * `POST /projects/{id}/merge_requests/{merge_request_iid}/discussions` to post inline discussion comments.
  * Parameters passed match: `position` object (including `base_sha`, `start_sha`, `head_sha`, `position_type: "text"`, `new_path`, `new_line`).
