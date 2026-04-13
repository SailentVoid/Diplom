import classes from "./avatar_sect.module.scss"

export default function Avatar_sect({ onStart }) {
    return (
        <section className={classes.Avatar}>
            <main>
                <div>
                    <div className={classes.Header}>
                        <h2>Личный кабинет</h2>
                    </div>
                    <div className={classes.Content}>
                        <div className={classes.Avatar_block}>
                            <div className={classes.Avatar_placeholder}>
                                <span>👤</span>
                            </div>
                            <button type="button" onClick={onStart}>Заполнить данные</button>
                        </div>
                    </div>
                </div>
            </main>
        </section>
    )
}
