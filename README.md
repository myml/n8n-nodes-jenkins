# @myml/n8n-nodes-jenkins

This is an n8n community node. It lets you use Jenkins in your n8n workflows.

The node was extracted from the n8n built-in Jenkins node. It supports the same
operations and credentials, plus a **Get Job** operation that fetches a single
job.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In the n8n community nodes search, look for `@myml/n8n-nodes-jenkins` to install this package.

## Operations

The node exposes three resources:

- **Job**
  - Copy a job
  - Create a job
  - **Get a job** (added in this package)
  - Trigger a job
  - Trigger a job with parameters
- **Build**
  - Get many builds
- **Instance**
  - Cancel quiet down
  - Quiet down
  - Restart
  - Safely restart
  - Safely shutdown
  - Shutdown

## Credentials

This node reuses n8n's built-in **Jenkins API** credential type, so there is no
separate credential bundled with this package. Configure the built-in credential
as usual:

1. Open your Jenkins user profile, then **Settings**.
2. Click **Add new token** in the **API Token** section.
3. Copy the token value.

Create an n8n credential of type **Jenkins API** with:

- **Jenkins Username**: your Jenkins username
- **Personal API Token**: the token from step 3
- **Jenkins Instance URL**: e.g. `https://jenkins.example.com`

## Compatibility

Tested with n8n 1.x and Jenkins 2.x.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Jenkins Remote Access API](https://www.jenkins.io/doc/book/using/remote-access-api/)
