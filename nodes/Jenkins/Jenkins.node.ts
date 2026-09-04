import type {
	IExecuteFunctions,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions -- CredentialTestContext only exposes the legacy helpers.request API
	IRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { buildTriggerResponse, jenkinsApiRequest, jenkinsApiRequestFull, tolerateTrailingSlash } from './GenericFunctions';

export type JenkinsApiCredentials = {
	username: string;
	apiKey: string;
	baseUrl: string;
};

export class Jenkins implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jenkins (Community)',
		name: 'jenkins',
		icon: 'file:jenkins.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Jenkins API',
		defaults: {
			name: 'Jenkins (Community)',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'jenkinsApi',
				required: true,
				testedBy: 'jenkinApiCredentialTest',
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Build',
						value: 'build',
					},
					{
						name: 'Custom API Call',
						value: 'customApi',
					},
					{
						name: 'Instance',
						value: 'instance',
					},
					{
						name: 'Job',
						value: 'job',
					},
					{
						name: 'Node',
						value: 'node',
					},
					{
						name: 'Queue',
						value: 'queue',
					},
				],
				default: 'job',
				noDataExpression: true,
			},

			// --------------------------------------------------------------------------------------------------------
			//         Job Operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['job'],
					},
				},
				options: [
					{
						name: 'Copy',
						value: 'copy',
						description: 'Copy a specific job',
						action: 'Copy a job',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new job',
						action: 'Create a job',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single job',
						action: 'Get a job',
					},
					{
						name: 'Trigger',
						value: 'trigger',
						description: 'Trigger a specific job. Returns the queue item ID, which you can poll to find the build number.',
						action: 'Trigger a job',
					},
					{
						name: 'Trigger with Parameters',
						value: 'triggerParams',
						description: 'Trigger a specific job with parameters. Returns the queue item ID, which you can poll to find the build number.',
						action: 'Trigger a job with parameters',
					},
				],
				default: 'trigger',
				description: 'Possible operations',
				noDataExpression: true,
			},
			{
				displayName:
					'Make sure the job is setup to support triggering with parameters. <a href="https://wiki.jenkins.io/display/JENKINS/Parameterized+Build" target="_blank">More info</a>',
				name: 'triggerParamsNotice',
				type: 'notice',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['triggerParams'],
					},
				},
				default: '',
			},
			{
				displayName: 'Job Name or ID',
				name: 'job',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getJobs',
				},
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['get', 'trigger', 'triggerParams', 'copy'],
					},
				},
				required: true,
				default: '',
				description:
					'Name of the job. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},

			// --------------------------------------------------------------------------------------------------------
			//         Trigger a Job
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Parameters',
				name: 'param',
				type: 'fixedCollection',
				placeholder: 'Add Parameter',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['triggerParams'],
					},
				},
				required: true,
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'params',
						displayName: 'Parameters',
						values: [
							{
								displayName: 'Name or ID',
								name: 'name',
								type: 'options',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
								typeOptions: {
									loadOptionsMethod: 'getJobParameters',
									loadOptionsDependsOn: ['job'],
								},
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
				description: 'Parameters for Jenkins job',
			},

			// --------------------------------------------------------------------------------------------------------
			//         Copy or Create a Job
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'New Job Name',
				name: 'newJob',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['copy', 'create'],
					},
				},
				required: true,
				default: '',
				description: 'Name of the new Jenkins job',
			},
			{
				displayName: 'XML',
				name: 'xml',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['create'],
					},
				},
				required: true,
				default: '',
				description: 'XML of Jenkins config',
			},
			{
				displayName:
					'To get the XML of an existing job, add ‘config.xml’ to the end of the job URL',
				name: 'createNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['create'],
					},
				},
			},

			// --------------------------------------------------------------------------------------------------------
			//         Jenkins operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['instance'],
					},
				},
				options: [
					{
						name: 'Cancel Quiet Down',
						value: 'cancelQuietDown',
						description: 'Cancel quiet down state',
						action: 'Cancel quiet down an instance',
					},
					{
						name: 'Quiet Down',
						value: 'quietDown',
						description:
							'Put Jenkins in quiet mode, no builds can be started, Jenkins is ready for shutdown',
						action: 'Quiet down an instance',
					},
					{
						name: 'Restart',
						value: 'restart',
						description: 'Restart Jenkins immediately on environments where it is possible',
						action: 'Restart an instance',
					},
					{
						name: 'Safely Restart',
						value: 'safeRestart',
						description:
							'Restart Jenkins once no jobs are running on environments where it is possible',
						action: 'Safely restart an instance',
					},
					{
						name: 'Safely Shutdown',
						value: 'safeExit',
						description: 'Shutdown once no jobs are running',
						action: 'Safely shutdown an instance',
					},
					{
						name: 'Shutdown',
						value: 'exit',
						description: 'Shutdown Jenkins immediately',
						action: 'Shutdown an instance',
					},
				],
				default: 'safeRestart',
				description: 'Jenkins instance operations',
				noDataExpression: true,
			},
			{
				displayName: 'Reason',
				name: 'reason',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['instance'],
						operation: ['quietDown'],
					},
				},
				default: '',
				description: 'Freeform reason for quiet down mode',
			},
			{
				displayName:
					'Instance operation can shutdown Jenkins instance and make it unresponsive. Some commands may not be available depending on instance implementation.',
				name: 'instanceNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						resource: ['instance'],
					},
				},
			},

			// --------------------------------------------------------------------------------------------------------
			//         Builds operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['build'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single build',
						action: 'Get a build',
					},
					{
						name: 'Get Log',
						value: 'getLog',
						description: 'Get the console log of a build',
						action: 'Get a build log',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List Builds',
						action: 'Get many builds',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Job Name or ID',
				name: 'job',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getJobs',
				},
				displayOptions: {
					show: {
						resource: ['build'],
						operation: ['get', 'getLog', 'getAll'],
					},
				},
				required: true,
				default: '',
				description:
					'Name of the job. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Build ID',
				name: 'buildId',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['build'],
						operation: ['get', 'getLog'],
					},
				},
				required: true,
				default: 1,
				description:
					'ID of the build. Use an <a href="https://docs.n8n.io/code/expressions/">expression</a> to reference it dynamically.',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['build'],
						operation: ['getAll'],
					},
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['build'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				description: 'Max number of results to return',
			},

			// --------------------------------------------------------------------------------------------------------
			//         Node (agent) operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['node'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single node (agent)',
						action: 'Get a node',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List many nodes (agents)',
						action: 'Get many nodes',
					},
					{
						name: 'Set Offline',
						value: 'setOffline',
						description: 'Take a node (agent) offline',
						action: 'Set a node offline',
					},
					{
						name: 'Set Online',
						value: 'setOnline',
						description: 'Bring a node (agent) back online',
						action: 'Set a node online',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Node Name or ID',
				name: 'nodeName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getNodes',
				},
				displayOptions: {
					show: {
						resource: ['node'],
						operation: ['get', 'setOffline', 'setOnline'],
					},
				},
				required: true,
				default: '',
				description:
					'Name of the node (agent). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Reason',
				name: 'reason',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['node'],
						operation: ['setOffline'],
					},
				},
				default: '',
				description: 'Optional reason for taking the node offline',
			},

			// --------------------------------------------------------------------------------------------------------
			//         Queue operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['queue'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single queue item',
						action: 'Get a queue item',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List many queue items',
						action: 'Get many queue items',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Queue Item ID',
				name: 'queueId',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['queue'],
						operation: ['get'],
					},
				},
				required: true,
				default: 1,
				description:
					'ID of the queue item. The Trigger operations return the queue item ID of the build they created.',
			},

			// --------------------------------------------------------------------------------------------------------
			//         Custom API operations
			// --------------------------------------------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				options: [
					{
						name: 'Call',
						value: 'call',
						description: 'Make an arbitrary request to the Jenkins API',
						action: 'Make a custom API call',
					},
				],
				default: 'call',
				description: 'Possible operations',
				noDataExpression: true,
			},
			{
				displayName: 'HTTP Method',
				name: 'method',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				options: [
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'GET', value: 'GET' },
					{ name: 'PATCH', value: 'PATCH' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
				],
				default: 'GET',
				description: 'HTTP method to use for the request',
				noDataExpression: true,
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				required: true,
				default: '',
				description:
					'Path of the API endpoint, relative to the Jenkins instance URL. Must start with a slash. For example: `/systemInfo` returns system information as JSON. Use an <a href="https://docs.n8n.io/code/expressions/">expression</a> to build it dynamically.',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				default: {},
				description: 'Query parameters to append to the request URL',
				options: [
					{
						name: 'values',
						displayName: 'Values',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the query parameter',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the query parameter',
							},
						],
					},
				],
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				default: '',
				description:
					'Body to send with the request, as a JSON string. For example: {"name": "value"}. Leave empty to send no body.',
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['customApi'],
					},
				},
				options: [
					{ name: 'JSON', value: 'json', description: 'Parse the response as JSON' },
					{ name: 'Text', value: 'text', description: 'Return the response as raw text' },
				],
				default: 'json',
				description:
					'Format of the response. Use text for endpoints that do not return JSON, such as console output.',
				noDataExpression: true,
			},
		],
	};

	methods = {
		credentialTest: {
			async jenkinApiCredentialTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const { baseUrl, username, apiKey } = credential.data as JenkinsApiCredentials;

				const url = tolerateTrailingSlash(baseUrl);
				const endpoint = '/api/json';

				// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions -- CredentialTestContext only exposes the legacy helpers.request API
				const options: IRequestOptions = {
					auth: {
						username,
						password: apiKey,
					},
					method: 'GET',
					body: {},
					qs: {},
					uri: `${url}${endpoint}`,
					json: true,
				};

				try {
					// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions -- CredentialTestContext only exposes the legacy helpers.request API
					await this.helpers.request(options);
					return {
						status: 'OK',
						message: 'Authentication successful',
					};
				} catch (error) {
					return {
						status: 'Error',
						message: error.message,
					};
				}
			},
		},
		loadOptions: {
			async getJobs(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const endpoint = '/api/json';
				const { jobs } = (await jenkinsApiRequest.call(this, 'GET', endpoint)) as {
					jobs: Array<{ name: string }>;
				};
				for (const job of jobs) {
					returnData.push({
						name: job.name,
						value: job.name,
					});
				}
				returnData.sort((a, b) => {
					if (a.name < b.name) {
						return -1;
					}
					if (a.name > b.name) {
						return 1;
					}
					return 0;
				});

				return returnData;
			},
			async getJobParameters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const job = this.getCurrentNodeParameter('job') as string;
				const returnData: INodePropertyOptions[] = [];
				const endpoint = `/job/${job}/api/json?tree=actions[parameterDefinitions[*]],property[parameterDefinitions[*]]`;
				const result = await jenkinsApiRequest.call(this, 'GET', endpoint);
				const allParameters: Array<{
					_class?: string;
					parameterDefinitions?: Array<{ name: string; type: string }>;
				}> = [
					...((result.actions as Array<{ _class?: string; parameterDefinitions?: Array<{ name: string; type: string }> }>) ??
						[]),
					...((result.property as Array<{ _class?: string; parameterDefinitions?: Array<{ name: string; type: string }> }>) ??
						[]),
				];
				const seenParameterNames = new Set<string>();
				for (const { _class, parameterDefinitions } of allParameters) {
					if (
						!_class?.includes('ParametersDefinitionProperty') ||
						!Array.isArray(parameterDefinitions)
					) {
						continue;
					}

					for (const { name, type } of parameterDefinitions) {
						if (!seenParameterNames.has(name)) {
							returnData.push({
								name: `${name} - (${type})`,
								value: name,
							});
							seenParameterNames.add(name);
						}
					}
				}
				returnData.sort((a, b) => {
					if (a.name < b.name) {
						return -1;
					}
					if (a.name > b.name) {
						return 1;
					}
					return 0;
				});

				return returnData;
			},
			async getNodes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const endpoint = '/computer/api/json?tree=computer[displayName]';
				const { computer } = (await jenkinsApiRequest.call(this, 'GET', endpoint)) as {
					computer: Array<{ displayName: string }>;
				};
				for (const node of computer) {
					returnData.push({
						name: node.displayName,
						value: node.displayName,
					});
				}
				returnData.sort((a, b) => {
					if (a.name < b.name) {
						return -1;
					}
					if (a.name > b.name) {
						return 1;
					}
					return 0;
				});

				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length;
		let responseData;
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);		for (let i = 0; i < length; i++) {
			try {
				if (resource === 'job') {
					if (operation === 'trigger') {
						const job = this.getNodeParameter('job', i) as string;
						const endpoint = `/job/${job}/build`;
						const fullResponse = await jenkinsApiRequestFull.call(this, 'POST', endpoint);
						responseData = buildTriggerResponse(fullResponse);
					}
					if (operation === 'triggerParams') {
						const job = this.getNodeParameter('job', i) as string;
						const params = this.getNodeParameter('param.params', i, []) as [];
						let form = {};
						if (params.length) {
							form = params.reduce((body: IDataObject, param: { name: string; value: string }) => {
								body[param.name] = param.value;
								return body;
							}, {});
						}
						const endpoint = `/job/${job}/buildWithParameters`;
						const fullResponse = await jenkinsApiRequestFull.call(
							this,
							'POST',
							endpoint,
							{},
							new URLSearchParams(form as Record<string, string>),
							{
								headers: {
									'content-type': 'application/x-www-form-urlencoded',
								},
							},
						);
						responseData = buildTriggerResponse(fullResponse);
					}
					if (operation === 'copy') {
						const job = this.getNodeParameter('job', i) as string;
						const name = this.getNodeParameter('newJob', i) as string;
						const queryParams = {
							name,
							mode: 'copy',
							from: job,
						};

						const endpoint = '/createItem';
						try {
							await jenkinsApiRequest.call(this, 'POST', endpoint, queryParams);
							responseData = { success: true };
						} catch (error) {
							if (error.httpCode === '302') {
								responseData = { success: true };
							} else {
								throw new NodeApiError(this.getNode(), error as JsonObject);
							}
						}
					}
					if (operation === 'create') {
						const name = this.getNodeParameter('newJob', i) as string;
						const queryParams = {
							name,
						};
						const headers = {
							'content-type': 'application/xml',
						};

						const body = this.getNodeParameter('xml', i) as string;

						const endpoint = '/createItem';
						await jenkinsApiRequest.call(this, 'POST', endpoint, queryParams, body, {
							headers,
							json: false,
						});
						responseData = { success: true };
					}
					if (operation === 'get') {
						const job = this.getNodeParameter('job', i) as string;
						const endpoint = `/job/${job}/api/json`;
						responseData = await jenkinsApiRequest.call(this, 'GET', endpoint);
					}
				}

				if (resource === 'instance') {
					if (operation === 'quietDown') {
						const reason = this.getNodeParameter('reason', i) as string;

						let queryParams;
						if (reason) {
							queryParams = {
								reason,
							};
						}

						const endpoint = '/quietDown';
						await jenkinsApiRequest.call(this, 'POST', endpoint, queryParams);
						responseData = { success: true };
					}
					if (operation === 'cancelQuietDown') {
						const endpoint = '/cancelQuietDown';
						await jenkinsApiRequest.call(this, 'POST', endpoint);
						responseData = { success: true };
					}
					if (operation === 'restart') {
						const endpoint = '/restart';
						try {
							await jenkinsApiRequest.call(this, 'POST', endpoint);
						} catch (error) {
							if (error.httpCode === '503') {
								responseData = { success: true };
							} else {
								throw new NodeApiError(this.getNode(), error as JsonObject);
							}
						}
					}
					if (operation === 'safeRestart') {
						const endpoint = '/safeRestart';
						try {
							await jenkinsApiRequest.call(this, 'POST', endpoint);
						} catch (error) {
							if (error.httpCode === '503') {
								responseData = { success: true };
							} else {
								throw new NodeApiError(this.getNode(), error as JsonObject);
							}
						}
					}
					if (operation === 'exit') {
						const endpoint = '/exit';
						await jenkinsApiRequest.call(this, 'POST', endpoint);
						responseData = { success: true };
					}
					if (operation === 'safeExit') {
						const endpoint = '/safeExit';
						await jenkinsApiRequest.call(this, 'POST', endpoint);
						responseData = { success: true };
					}
				}

				if (resource === 'build') {
					if (operation === 'get') {
						const job = this.getNodeParameter('job', i) as string;
						const buildId = this.getNodeParameter('buildId', i) as number;
						const endpoint = `/job/${job}/${buildId}/api/json`;
						responseData = await jenkinsApiRequest.call(this, 'GET', endpoint);
					}
					if (operation === 'getLog') {
						const job = this.getNodeParameter('job', i) as string;
						const buildId = this.getNodeParameter('buildId', i) as number;
						const endpoint = `/job/${job}/${buildId}/consoleText`;
						const log = (await jenkinsApiRequest.call(this, 'GET', endpoint, {}, '', {
							json: false,
							encoding: 'text',
						})) as unknown as string;
						responseData = { consoleText: log };
					}
					if (operation === 'getAll') {
						const job = this.getNodeParameter('job', i) as string;
						let endpoint = `/job/${job}/api/json?tree=builds[*]`;
						const returnAll = this.getNodeParameter('returnAll', i);

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i);
							endpoint += `{0,${limit}}`;
						}

						responseData = await jenkinsApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.builds;
					}
				}

				if (resource === 'node') {
					if (operation === 'getAll') {
						const endpoint = '/computer/api/json?tree=computer[*]';
						const response = await jenkinsApiRequest.call(this, 'GET', endpoint);
						responseData = response.computer;
					}
					if (operation === 'get') {
						const nodeName = this.getNodeParameter('nodeName', i) as string;
						const endpoint = `/computer/${encodeURIComponent(nodeName)}/api/json`;
						responseData = await jenkinsApiRequest.call(this, 'GET', endpoint);
					}
					if (operation === 'setOffline') {
						const nodeName = this.getNodeParameter('nodeName', i) as string;
						const reason = this.getNodeParameter('reason', i, '') as string;
						const queryParams: IDataObject = {};
						if (reason) {
							queryParams.offlineMessage = reason;
						}
						const endpoint = `/computer/${encodeURIComponent(nodeName)}/offline`;
						await jenkinsApiRequest.call(this, 'POST', endpoint, queryParams);
						responseData = { success: true };
					}
					if (operation === 'setOnline') {
						const nodeName = this.getNodeParameter('nodeName', i) as string;
						const endpoint = `/computer/${encodeURIComponent(nodeName)}/online`;
						await jenkinsApiRequest.call(this, 'POST', endpoint);
						responseData = { success: true };
					}
				}

				if (resource === 'queue') {
					if (operation === 'getAll') {
						const endpoint = '/queue/api/json?tree=items[*]';
						const response = await jenkinsApiRequest.call(this, 'GET', endpoint);
						responseData = response.items;
					}
					if (operation === 'get') {
						const queueId = this.getNodeParameter('queueId', i) as number;
						const endpoint = `/queue/item/${queueId}/api/json`;
						responseData = await jenkinsApiRequest.call(this, 'GET', endpoint);
					}
				}

				if (resource === 'customApi') {
					const method = this.getNodeParameter('method', i) as IHttpRequestMethods;
					const path = this.getNodeParameter('path', i) as string;
					const queryParameters = this.getNodeParameter(
						'queryParameters.values',
						i,
						[],
					) as Array<{ name: string; value: string }>;
					const body = this.getNodeParameter('body', i, '') as string;
					const responseFormat = this.getNodeParameter('responseFormat', i) as string;

					const qs: IDataObject = {};
					for (const param of queryParameters) {
						if (param.name) {
							qs[param.name] = param.value;
						}
					}

					let parsedBody: IHttpRequestOptions['body'] = '';
					if (body) {
						try {
							parsedBody = JSON.parse(body) as IHttpRequestOptions['body'];
						} catch (error) {
							throw new NodeOperationError(this.getNode(), `Body must be valid JSON: ${(error as Error).message}`);
						}
					}

					const option: Partial<IHttpRequestOptions> = {};
					if (responseFormat === 'text') {
						option.json = false;
						option.encoding = 'text';
					}

					const response = await jenkinsApiRequest.call(this, method, path, qs, parsedBody, option);
					responseData =
						responseFormat === 'text'
							? { text: response as unknown as string }
							: (response as IDataObject);
				}

				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData as IDataObject[]);
				} else {
					returnData.push(responseData as IDataObject);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
