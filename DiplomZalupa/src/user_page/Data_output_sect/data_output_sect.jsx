import classes from "./data_output_sect.module.scss"

export default function Data_output_sect({ userData }) {
    return (
        <section className={classes.DataOutput}>
            <main>
                <div>
                    <div className={classes.Header}>
                        <h2>Личный кабинет</h2>
                    </div>
                    <div className={classes.Content}>
                        <div>
                            <label>ФИО</label>
                            <p>{userData.fullname}</p>
                        </div>
                        <div>
                            <label>Дата рождения</label>
                            <p>{userData.birthdate}</p>
                        </div>
                        <div>
                            <label>Телефон</label>
                            <p>{userData.phone}</p>
                        </div>
                        <div>
                            <label>Email</label>
                            <p>{userData.email}</p>
                        </div>
                        <p className={classes.Locked_note}>
                            Данные можно ввести один раз. Изменение — по заявке к администратору.
                        </p>
                    </div>
                </div>
            </main>
        </section>
    )
}
