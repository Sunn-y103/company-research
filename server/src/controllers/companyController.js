import * as companyService from '../services/companyService.js';

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await companyService.getAllCompanies();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const company = await companyService.getCompanyById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCompany = async (req, res) => {
  try {
    const company = await companyService.createCompany(req.body);
    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const company = await companyService.updateCompany(req.params.id, req.body);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    await companyService.deleteCompany(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};