import Header from '../header/header.jsx'
import Footer from '../footer/footer.jsx'
import Sect1 from '../home_page/section1/section1.jsx'
import Sect2 from '../home_page/section2/section2.jsx'
import Sect3 from '../home_page/section3/section3.jsx'
import classes from '../home_page/index.module.scss'
export default function Page1(){
    return(
        <>
            <div className = {classes.container}>
                <div className={classes.sec_container}>
                    <Sect1/>
                    <Sect2/>
                    <Sect3/>
                </div>

            </div>
        </>
    )
}
