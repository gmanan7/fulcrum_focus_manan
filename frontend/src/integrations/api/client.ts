export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class APIClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  public setToken(token: string | null): void {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return data as T;
  }

  // Auth Endpoints
  async login(email: string, password: string) {
    const res = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async register(data: { fullName: string; email: string; password: string; employeeId?: string; designation?: string }) {
    const res = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async logout() {
    this.setToken(null);
  }

  // Users Endpoints
  async getUsers() {
    return this.request('/users');
  }

  async getUser(id: string) {
    return this.request(`/users/${id}`);
  }

  // Departments & Factories Endpoints
  async getFactories() {
    return this.request('/departments/factories');
  }

  async getDepartments(factoryId?: string) {
    const query = factoryId ? `?factoryId=${factoryId}` : '';
    return this.request(`/departments${query}`);
  }

  // KPI Endpoints
  async getKPIs(departmentId?: string) {
    const query = departmentId ? `?departmentId=${departmentId}` : '';
    return this.request(`/kpi${query}`);
  }

  async getKPIEntries(kpiId: string, startDate?: string, endDate?: string) {
    let query = '';
    if (startDate && endDate) {
      query = `?startDate=${startDate}&endDate=${endDate}`;
    }
    return this.request(`/kpi/${kpiId}/entries${query}`);
  }

  async submitKPIEntry(entryData: any) {
    return this.request('/kpi/entries', {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  }

  // Tasks Endpoints
  async getTasks(filters?: { departmentId?: string; status?: string; assigneeId?: string; meetingId?: string }) {
    const params = new URLSearchParams();
    if (filters?.departmentId) params.append('departmentId', filters.departmentId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assigneeId) params.append('assigneeId', filters.assigneeId);
    if (filters?.meetingId) params.append('meetingId', filters.meetingId);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/tasks${queryString}`);
  }

  async createTask(taskData: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(id: string, taskData: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  async updateTaskStatus(id: string, status: string, reason?: string) {
    return this.request(`/tasks/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  async updateTaskDueDate(id: string, dueDate: string, reason?: string) {
    return this.request(`/tasks/${id}/due-date`, {
      method: 'PUT',
      body: JSON.stringify({ dueDate, reason }),
    });
  }

  // Meetings Endpoints
  async getMeetings(departmentId?: string, date?: string) {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    if (date) params.append('date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/meetings${query}`);
  }

  async createMeeting(meetingData: any) {
    return this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }

  // PD Endpoints
  async getPDJobs(departmentId?: string, stage?: string) {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    if (stage) params.append('stage', stage);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/pd-jobs${query}`);
  }

  async updatePDStage(id: string, stage: string, notes?: string) {
    return this.request(`/pd-jobs/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage, notes }),
    });
  }

  // Audit Logs
  async getAuditLogs(tableName?: string, action?: string) {
    const params = new URLSearchParams();
    if (tableName) params.append('tableName', tableName);
    if (action) params.append('action', action);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/audit-logs${query}`);
  }
}

export const apiClient = new APIClient();
export default apiClient;
