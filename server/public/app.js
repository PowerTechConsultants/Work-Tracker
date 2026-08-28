document.getElementById('ping').addEventListener('click', async () => {
  const res = await fetch('/healthz');
  const text = await res.text();
  document.getElementById('result').textContent = text;
});
