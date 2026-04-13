
import Log_sect from '../sig_log/Log_sect/log_sect.jsx'
import Sign_sect from '../sig_log/Sign_sect/sign_sect.jsx'
import { useState } from "react";
export default function PageLogSig(){
  const [isLogin, setIsLogin] = useState(true);
    return(
        <>
           <div>
                {isLogin ? (
              <Log_sect onSwitch={() => setIsLogin(false)} />
              ) : (
              <Sign_sect onSwitch={() => setIsLogin(true)} />
              )}
         </div>
        </>
    )
}
