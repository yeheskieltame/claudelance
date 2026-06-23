// Tiny zero-dependency client over the Claudelance Coworking REST API. The
// published @yeheskieltame/claudelance-coworking-sdk is the client for external
// consumers; this runtime keeps its own ~60-line fetch wrapper so it runs on a
// bare `node` with no install/build step. The endpoints mirror the SDK exactly.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CoworkingApi {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  // ponytail: retry only transient network failures (fetch rejects), not HTTP
  // 4xx/5xx - those are real and must surface. 3 tries, linear backoff.
  async req(method, path, body) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res;
      try {
        res = await fetch(`${this.baseUrl}/v1${path}`, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        lastErr = err;
        await sleep(attempt * 400);
        continue;
      }
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const detail = data?.error?.message ?? data?.message ?? text;
        throw new Error(`${method} ${path} -> ${res.status} ${detail}`);
      }
      return data;
    }
    throw new Error(`${method} ${path} -> network: ${lastErr?.message ?? 'fetch failed'}`);
  }

  // --- identity / workspace ---
  async health() {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }
  getMe() { return this.req('GET', '/me'); }
  getWorkspace() { return this.req('GET', '/workspace'); }

  // --- members / keys (admin) ---
  async listMembers() { return (await this.req('GET', '/members')).items; }
  createMember(input) { return this.req('POST', '/members', input); }
  createApiKey(input) { return this.req('POST', '/keys', input); }

  // --- projects / board ---
  async listProjects() { return (await this.req('GET', '/projects')).items; }
  createProject(input) { return this.req('POST', '/projects', input); }
  async listColumns(projectId) { return (await this.req('GET', `/projects/${projectId}/columns`)).items; }

  // --- tasks ---
  async listTasks(projectId) { return (await this.req('GET', `/tasks?projectId=${projectId}`)).items; }
  createTask(input) { return this.req('POST', '/tasks', input); }
  claimTask(id) { return this.req('POST', `/tasks/${id}/claim`); }
  assignTask(id, memberId) { return this.req('POST', `/tasks/${id}/assign`, { memberId }); }
  setStatus(id, statusColumnKey) { return this.req('POST', `/tasks/${id}/status`, { statusColumnKey }); }
  addComment(id, body) { return this.req('POST', `/tasks/${id}/comments`, { body }); }
  requestReview(id, reviewerMemberId) { return this.req('POST', `/tasks/${id}/request-review`, { reviewerMemberId }); }
  submitReview(id, input) { return this.req('POST', `/tasks/${id}/review`, input); }

  // --- coordination ---
  async myOpenTasks() { return (await this.req('GET', '/me/tasks')).items; }
  async whatsNext(projectId, type) {
    const q = type ? `?type=${encodeURIComponent(type)}` : '';
    return (await this.req('GET', `/projects/${projectId}/next${q}`)).items;
  }
  async myReviews() { return (await this.req('GET', '/me/reviews')).items; }
}
