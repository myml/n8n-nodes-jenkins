import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export function tolerateTrailingSlash(baseUrl: string) {
	return baseUrl.endsWith('/') ? baseUrl.substr(0, baseUrl.length - 1) : baseUrl;
}

export async function jenkinsApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	uri: string,
	qs: IDataObject = {},
	body: IHttpRequestOptions['body'] = '',
	option: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
	const credentials = await this.getCredentials('jenkinsApi');
	const options: IHttpRequestOptions = {
		headers: {
			Accept: 'application/json',
		},
		method,
		auth: {
			username: credentials.username as string,
			password: credentials.apiKey as string,
		},
		url: `${tolerateTrailingSlash(credentials.baseUrl as string)}${uri}`,
		json: true,
		qs,
		body,
	};
	const mergedOptions = Object.assign({}, options, option) as IHttpRequestOptions;
	try {
		// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- JenkinsApi has no authenticate() method; manual basic auth required
		return (await this.helpers.httpRequest(mergedOptions)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
