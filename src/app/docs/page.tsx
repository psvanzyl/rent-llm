export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">API documentation</h1>
      <p className="mt-2 text-gray-400">
        RentLLM exposes an OpenAI-compatible API. Use any OpenAI SDK or plain HTTP.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Authentication</h2>
      <p className="mt-2 text-sm text-gray-400">
        Pass your API key as a Bearer token in the Authorization header.
      </p>
      <pre className="mt-3 rounded-lg border border-gray-800 bg-black p-4 text-sm overflow-x-auto">
{`Authorization: Bearer YOUR_API_KEY`}
      </pre>

      <h2 className="mt-8 text-lg font-semibold">List models</h2>
      <pre className="mt-3 rounded-lg border border-gray-800 bg-black p-4 text-sm overflow-x-auto">
{`curl https://broomy.laserraptor.eu/api/v1/models \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
      </pre>

      <h2 className="mt-8 text-lg font-semibold">Chat completions</h2>
      <pre className="mt-3 rounded-lg border border-gray-800 bg-black p-4 text-sm overflow-x-auto">
{`curl https://broomy.laserraptor.eu/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen3.8-flash",
    "messages": [{"role":"user","content":"Hello!"}],
    "stream": false
  }'`}
      </pre>

      <h2 className="mt-8 text-lg font-semibold">Streaming</h2>
      <p className="mt-2 text-sm text-gray-400">
        Set <code className="text-cyan-300">stream: true</code> to receive Server-Sent Events in OpenAI format.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Using the OpenAI SDK (Python)</h2>
      <pre className="mt-3 rounded-lg border border-gray-800 bg-black p-4 text-sm overflow-x-auto">
{`from openai import OpenAI
client = OpenAI(
    base_url="https://broomy.laserraptor.eu/api/v1",
    api_key="YOUR_API_KEY",
)
resp = client.chat.completions.create(
    model="qwen3.8-flash",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`}
      </pre>
    </div>
  );
}
