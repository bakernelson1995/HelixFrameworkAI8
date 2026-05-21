const API_URL = import.meta.env?.VITE_API_URL || '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

// Department Brain
export const departmentBrainAPI = {
  uploadFiles: async (files: FileList, metadata: Record<string, string> = {}) => {
    const formData = new FormData();
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value);
    });
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    return request('/api/department-brain/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

// AI Consultant
export const consultantAPI = {
  analyzeDepartment: async (departmentReflection: string, departmentScore: any) => {
    return request('/api/consultant/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentReflection,
        departmentScore,
      }),
    });
  },
};

// Assignment Aligner
export const assignmentAlignerAPI = {
  analyzeAssignments: async (files: FileList, metadata: Record<string, string> = {}) => {
    const formData = new FormData();
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value);
    });
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    return request('/api/assignment-aligner/analyze', {
      method: 'POST',
      body: formData,
    });
  },
};

// PLC Insights
export const plcAPI = {
  getInsights: async (course: string, grade: string, domain: string, skill: string) => {
    return request('/api/plc/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course,
        grade,
        domain,
        skill,
      }),
    });
  },
};

// Health
export const healthAPI = {
  check: async () => {
    return request('/health');
  },
};
