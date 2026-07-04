import * as aiService from '../services/aiService.js';

export const researchCompany = async (req, res) => {
  try {
    const { companyName } = req.body;
    const results = await aiService.researchCompany(companyName);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const analyzeData = async (req, res) => {
  try {
    const { data } = req.body;
    const analysis = await aiService.analyzeData(data);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const summarizeFindings = async (req, res) => {
  try {
    const { findings } = req.body;
    const summary = await aiService.summarizeFindings(findings);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};