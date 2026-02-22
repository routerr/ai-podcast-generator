const test = async () => {
  try {
    const res = await fetch('http://localhost:3001/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'openrouter',
        apiKey: 'test-api-key',
        payload: {
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: 'hello' }]
        }
      })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Text:', text);
  } catch (error) {
    console.error('Fetch error:', error);
  }
};
test();
