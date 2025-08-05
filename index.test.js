const request = require('supertest');
const app = require('../index');

describe('API Endpoints', () => {
  test('GET /api/flats returns apartments', async () => {
    const response = await request(app).get('/api/flats');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('POST /api/inquiries submits inquiry', async () => {
    const inquiry = { name: 'Test User', email: 'test@example.com', message: 'Hello' };
    const response = await request(app).post('/api/inquiries').send(inquiry);
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Inquiry submitted successfully');
  });
});
