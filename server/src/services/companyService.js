const companies = [];

export const getAllCompanies = async () => {
  return companies;
};

export const getCompanyById = async (id) => {
  return companies.find(c => c.id === id);
};

export const createCompany = async (companyData) => {
  const company = {
    id: Date.now().toString(),
    ...companyData,
    createdAt: new Date().toISOString()
  };
  companies.push(company);
  return company;
};

export const updateCompany = async (id, companyData) => {
  const index = companies.findIndex(c => c.id === id);
  if (index === -1) return null;
  companies[index] = { ...companies[index], ...companyData };
  return companies[index];
};

export const deleteCompany = async (id) => {
  const index = companies.findIndex(c => c.id === id);
  if (index === -1) return false;
  companies.splice(index, 1);
  return true;
};