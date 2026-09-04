# @myml/n8n-nodes-jenkins

This is an n8n community node. It lets you use Jenkins in your n8n workflows.

The node was extracted from the n8n built-in Jenkins node. It supports the same
operations and credentials, plus these additions:

- **Get Job**: fetch a single job (the built-in node only lists jobs)
- **Build > Get Log**: fetch the console log of a build
- **Node (agent) resources**: get, list, take offline, bring online
- **Queue resources**: get a single queue item or list the queue
- **Trigger** / **Trigger with Parameters** return the **queue item ID** of the
  triggered build, so you can poll the queue to find the build number

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

The node exposes five resources:

- **Job**
  - Copy a job
  - Create a job
  - **Get a job** (added in this package)
  - Trigger a job — returns the queue item ID of the build
  - Trigger a job with parameters — returns the queue item ID of the build
- **Build**
  - Get a build
  - **Get a build log** (added in this package)
  - Get many builds
- **Instance**
  - Cancel quiet down
  - Quiet down
  - Restart
  - Safely restart
  - Safely shutdown
  - Shutdown
- **Node (agent)**
  - Get a node
  - Get many nodes
  - Set a node offline
  - Set a node online
- **Queue**
  - Get a queue item
  - Get many queue items

When a job is triggered, Jenkins does not return the build number directly.
The Trigger operations return the **queue item ID** instead. Poll the **Queue >
Get** operation until its `executable` field is set — that field contains the
`number` and `url` of the build. The `executable` field is `null` while the
build is still waiting in the queue.

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
