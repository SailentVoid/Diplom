import { jwtDecode } from "jwt-decode";
import classes from "./section1.module.scss";

const getUserName = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return "";
  }

  try {
    const decoded = jwtDecode(token);

    return decoded.fio || decoded.login || "";
  } catch (err) {
    console.error("ошибка декодирования токена", err);
    return "";
  }
};

export default function Sect1() {
  const fio = getUserName();

  return (
    <section className={classes.Greeting}>
      <div>
        <h2>Добрый день!</h2>
        <p>{fio || "Нет данных"}</p>
      </div>
    </section>
  );
}
