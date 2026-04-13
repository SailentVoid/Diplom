import classes from "./data_input_sect.module.scss"

export default function Data_input_sect({ formData, onChange, onSave, onCancel }) {
    return (
        <section className={classes.DataInput}>
            <main>
                <div>
                    <div className={classes.Header}>
                        <h2>Личный кабинет</h2>
                    </div>
                    <div className={classes.Content}>
                        <div>
                            <label>ФИО</label>
                            <input
                                type="text"
                                placeholder="Иванов Иван Иванович"
                                value={formData.fullname}
                                onChange={(e) => onChange("fullname", e.target.value)}
                            />
                        </div>
                        <div>
                            <label>Дата рождения</label>
                            <input
                                type="date"
                                value={formData.birthdate}
                                onChange={(e) => onChange("birthdate", e.target.value)}
                            />
                        </div>
                        <div>
                            <label>Телефон</label>
                            <input
                                type="tel"
                                placeholder="+375 (XX) XXX-XX-XX"
                                value={formData.phone}
                                onChange={(e) => onChange("phone", e.target.value)}
                            />
                        </div>
                        <div>
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="example@mail.by"
                                value={formData.email}
                                onChange={(e) => onChange("email", e.target.value)}
                            />
                        </div>
                        <div className={classes.Buttons_row}>
                            <button type="button" onClick={onSave}>Сохранить</button>
                            <button type="button" onClick={onCancel}>Отмена</button>
                        </div>
                    </div>
                </div>
            </main>
        </section>
    )
}
