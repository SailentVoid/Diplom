import classes from './section3.module.scss'

export default function Sect3(){
    return(
        <section className={classes.Payments}>
            <div>
                <h3>История платежей</h3>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <td>Дата</td>
                                <td>Описание</td>
                                <td>Сумма</td>
                                <td>Статус</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="empty" colSpan="4">История платежей пуста</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
