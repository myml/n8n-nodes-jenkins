import { mockDeep } from 'vitest-mock-extended';
import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
} from 'n8n-workflow';

import * as GenericFunctions from '../GenericFunctions';
import { Jenkins } from '../Jenkins.node';
import type { Mocked, MockInstance } from 'vitest';

describe('Jenkins node', () => {
	let node: Jenkins;
	let loadOptionsFunctions: Mocked<ILoadOptionsFunctions>;
	let jenkinsApiRequestSpy: MockInstance;

	beforeEach(() => {
		node = new Jenkins();
		loadOptionsFunctions = mockDeep<ILoadOptionsFunctions>();
		loadOptionsFunctions.getCurrentNodeParameter.mockReturnValue('demo-job');
		vi.clearAllMocks();
		jenkinsApiRequestSpy = vi.spyOn(GenericFunctions, 'jenkinsApiRequest');
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('loadOptions.getJobParameters', () => {
		it('loads parameters from actions', async () => {
			jenkinsApiRequestSpy.mockResolvedValue({
				actions: [
					{
						_class: 'hudson.model.ParametersDefinitionProperty',
						parameterDefinitions: [
							{ name: 'BRANCH', type: 'StringParameterDefinition' },
							{ name: 'DRY_RUN', type: 'BooleanParameterDefinition' },
						],
					},
				],
			});

			const result = await node.methods.loadOptions.getJobParameters.call(loadOptionsFunctions);

			expect(result).toEqual<INodePropertyOptions[]>([
				{ name: 'BRANCH - (StringParameterDefinition)', value: 'BRANCH' },
				{ name: 'DRY_RUN - (BooleanParameterDefinition)', value: 'DRY_RUN' },
			]);
			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				'/job/demo-job/api/json?tree=actions[parameterDefinitions[*]],property[parameterDefinitions[*]]',
			);
		});

		it('loads parameters from property', async () => {
			jenkinsApiRequestSpy.mockResolvedValue({
				property: [
					{
						_class:
							'org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty ParametersDefinitionProperty',
						parameterDefinitions: [{ name: 'VERSION', type: 'StringParameterDefinition' }],
					},
				],
			});

			const result = await node.methods.loadOptions.getJobParameters.call(loadOptionsFunctions);

			expect(result).toEqual<INodePropertyOptions[]>([
				{ name: 'VERSION - (StringParameterDefinition)', value: 'VERSION' },
			]);
		});

		it('merges actions and property results and deduplicates parameter names', async () => {
			jenkinsApiRequestSpy.mockResolvedValue({
				actions: [
					{
						_class: 'hudson.model.ParametersDefinitionProperty',
						parameterDefinitions: [{ name: 'ENV', type: 'StringParameterDefinition' }],
					},
				],
				property: [
					{
						_class: 'hudson.model.ParametersDefinitionProperty',
						parameterDefinitions: [
							{ name: 'ENV', type: 'StringParameterDefinition' },
							{ name: 'REGION', type: 'ChoiceParameterDefinition' },
						],
					},
				],
			});

			const result = await node.methods.loadOptions.getJobParameters.call(loadOptionsFunctions);

			expect(result).toEqual<INodePropertyOptions[]>([
				{ name: 'ENV - (StringParameterDefinition)', value: 'ENV' },
				{ name: 'REGION - (ChoiceParameterDefinition)', value: 'REGION' },
			]);
		});

		it('filters non parameter classes and sorts by display name', async () => {
			jenkinsApiRequestSpy.mockResolvedValue({
				actions: [
					{
						_class: 'hudson.model.ScmProperty',
						parameterDefinitions: [
							{ name: 'SHOULD_NOT_APPEAR', type: 'StringParameterDefinition' },
						],
					},
					{
						_class: 'hudson.model.ParametersDefinitionProperty',
						parameterDefinitions: [
							{ name: 'ZZZ', type: 'StringParameterDefinition' },
							{ name: 'AAA', type: 'StringParameterDefinition' },
						],
					},
				],
			});

			const result = await node.methods.loadOptions.getJobParameters.call(loadOptionsFunctions);

			expect(result).toEqual<INodePropertyOptions[]>([
				{ name: 'AAA - (StringParameterDefinition)', value: 'AAA' },
				{ name: 'ZZZ - (StringParameterDefinition)', value: 'ZZZ' },
			]);
		});
	});

	describe('execute', () => {
		let executeFunctions: Mocked<IExecuteFunctions>;
		let jenkinsApiRequestFullSpy: MockInstance;

		beforeEach(() => {
			executeFunctions = mockDeep<IExecuteFunctions>();
			executeFunctions.getInputData.mockReturnValue([{ json: {} }]);
			executeFunctions.helpers.returnJsonArray.mockImplementation((data) => {
				const items = Array.isArray(data) ? data : [data];
				return items.map((item) => ({ json: item })) as INodeExecutionData[];
			});
			jenkinsApiRequestFullSpy = vi.spyOn(GenericFunctions, 'jenkinsApiRequestFull');
		});

		it('gets a single job', async () => {
			const jobData = { _class: 'hudson.model.FreeStyleProject', name: 'demo-job' };
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'job',
					operation: 'get',
					job: 'demo-job',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue(jobData);

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/job/demo-job/api/json');
			expect(result).toEqual([[{ json: jobData }]]);
		});

		it('triggers a job and returns the queue item id from the Location header', async () => {
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'job',
					operation: 'trigger',
					job: 'demo-job',
				};
				return params[param] as never;
			});
			jenkinsApiRequestFullSpy.mockResolvedValue({
				headers: { location: 'http://jenkins.local/queue/item/123/' },
				statusCode: 201,
				statusMessage: 'Created',
				body: {},
			});

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestFullSpy).toHaveBeenCalledWith('POST', '/job/demo-job/build');
			expect(result).toEqual([
				[{ json: { success: true, queueUrl: 'http://jenkins.local/queue/item/123/', queueId: 123 } }],
			]);
		});

		it('gets a single build', async () => {
			const buildData = { _class: 'hudson.model.FreeStyleBuild', number: 42, result: 'SUCCESS' };
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'build',
					operation: 'get',
					job: 'demo-job',
					buildId: 42,
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue(buildData);

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/job/demo-job/42/api/json');
			expect(result).toEqual([[{ json: buildData }]]);
		});

		it('gets a build console log', async () => {
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'build',
					operation: 'getLog',
					job: 'demo-job',
					buildId: 42,
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue('Started by user admin\nBuilding...\nFinished: SUCCESS');

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				'/job/demo-job/42/consoleText',
				{},
				'',
				{ json: false, encoding: 'text' },
			);
			expect(result).toEqual([
				[{ json: { consoleText: 'Started by user admin\nBuilding...\nFinished: SUCCESS' } }],
			]);
		});

		it('gets all nodes', async () => {
			const computer = [
				{ displayName: 'built-in node', offline: false },
				{ displayName: 'agent-1', offline: false },
			];
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'node',
					operation: 'getAll',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue({ computer });

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/computer/api/json?tree=computer[*]');
			expect(result).toEqual([[{ json: computer[0] }, { json: computer[1] }]]);
		});

		it('gets a single node', async () => {
			const nodeData = { displayName: 'agent-1', offline: false, idle: true };
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'node',
					operation: 'get',
					nodeName: 'agent-1',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue(nodeData);

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/computer/agent-1/api/json');
			expect(result).toEqual([[{ json: nodeData }]]);
		});

		it('sets a node offline with a reason', async () => {
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'node',
					operation: 'setOffline',
					nodeName: 'agent-1',
					reason: 'maintenance',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue({});

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith(
				'POST',
				'/computer/agent-1/offline',
				{ offlineMessage: 'maintenance' },
			);
			expect(result).toEqual([[{ json: { success: true } }]]);
		});

		it('sets a node online', async () => {
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'node',
					operation: 'setOnline',
					nodeName: 'agent-1',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue({});

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('POST', '/computer/agent-1/online');
			expect(result).toEqual([[{ json: { success: true } }]]);
		});

		it('gets all queue items', async () => {
			const items = [{ id: 123, why: 'Waiting for next available executor' }];
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'queue',
					operation: 'getAll',
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue({ items });

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/queue/api/json?tree=items[*]');
			expect(result).toEqual([[{ json: items[0] }]]);
		});

		it('gets a single queue item', async () => {
			const itemData = {
				id: 123,
				why: 'Build #7 is already in progress',
				executable: { number: 7, url: 'http://jenkins.local/job/demo-job/7/' },
			};
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, unknown> = {
					resource: 'queue',
					operation: 'get',
					queueId: 123,
				};
				return params[param] as never;
			});
			jenkinsApiRequestSpy.mockResolvedValue(itemData);

			const result = await node.execute.call(executeFunctions);

			expect(jenkinsApiRequestSpy).toHaveBeenCalledWith('GET', '/queue/item/123/api/json');
			expect(result).toEqual([[{ json: itemData }]]);
		});
	});
});
