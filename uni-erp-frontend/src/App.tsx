import { useEffect, useState } from "react";

function App() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5000/api/test")
      .then((res) => res.json())
      .then((data) => {
        console.log(data); // debug
        setMsg(data.message);
      })
      .catch((err) => {
        console.error(err);
        setMsg("Error connecting to backend");
      });
  }, []);

  return (
    <div>
      <h1>UNI ERP</h1>
      <p>{msg}</p>
    </div>
  );
}

export default App;