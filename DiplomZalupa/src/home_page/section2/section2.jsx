import styleses from "../section2/section2.module.scss"
export default function Sect2(){
    return(
        <>
         <section className={styleses.Balance}>
            <div>
                <div className={styleses.Balance_container}>
                    <div className={styleses.BalanceInfo}>
                         <p>Баланс лицевого счёта:</p>
                         <p>0.00 BYN</p>
                    </div>
                         <button>Оплатить</button>
                </div>
            </div>
        </section>
        </>
       
    )
}
