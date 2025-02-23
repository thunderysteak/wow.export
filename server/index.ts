/* Copyright (c) wow.export contributors. All rights reserved. */
/* Licensed under the MIT license. See LICENSE in project root for license information. */
import http from 'http';

function make_generic_response(status_code: number): Response {
	return new Response(http.STATUS_CODES[status_code], { status: status_code });
}

const server = Bun.serve({
	port: 3001, // Do not change without consulting @Kruithne
	development: false,

	async fetch(req) {
		const url = new URL(req.url);

		// /services/internal/update is called from the automatic deployment workflow on GitHub
		// to indicate that the server sources have been updated and the server should initiate
		// a self-update.
		if (url.pathname === '/services/internal/update') {
			// This endpoint must be called with the correct key to prevent abuse.
			if (url.searchParams.get('key') !== process.env.WOW_EXPORT_SERVER_DEPLOY_KEY)
				return make_generic_response(401); // Unauthorized

			server.stop(true); // TODO: Implement convinient-termination for this.
			return make_generic_response(200); // OK
		}

		// /services/internal/head is called from the automatic deployment workflow on GitHub
		// to check the current commit hash of the server.
		if (url.pathname === '/services/internal/head') {
			if (url.searchParams.get('key') !== process.env.WOW_EXPORT_SERVER_DEPLOY_KEY)
				return make_generic_response(401); // Unauthorized

			const git = Bun.spawn(['git', 'rev-parse', 'HEAD']);

			// TODO: Fortify this against potentially returning an error.
			return new Response(git.stdout, { status: 200 });
		}

		return make_generic_response(404); // Not found
	},

	error(error: Error) {
		console.error(error);
		return make_generic_response(500); // Internal Server Error
	}
});

console.log(`Ready for connections ${server.port}...`);