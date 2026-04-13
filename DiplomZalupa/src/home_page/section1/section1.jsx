import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import classes from "./section1.module.scss";

export default function Sect1() {
  const [fio, setFio] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setFio("");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      console.log("decoded token:", decoded);

      const name = decoded.fio  || decoded.login || ""; // теперь fio читается из токена

      setFio(name);
    } catch (err) {
      console.error("ошибка декодирования токена", err);
      setFio("");
    }
  }, []);

  return (
    <section className={classes.Greeting}>
      <div>
        <h2>Добрый день!</h2>
        <p>{fio || "Нет данных"}</p>
      </div>
    </section>
  );
}