
import Log_sect from '../sig_log/Log_sect/log_sect.jsx'
import Sign_sect from '../sig_log/Sign_sect/sign_sect.jsx'
import Password_reset_sect from './Password_Reset_sect/password_reset_sect.jsx'
import { useState } from "react";
export default function PageLogSig(){
  const [activeSection, setActiveSection] = useState('login');

    return(
        <>
           <div>
                {activeSection === 'login' && (
              <Log_sect
                onSwitch={() => setActiveSection('register')}
                onResetPassword={() => setActiveSection('reset')}
              />
              )}
              {activeSection === 'register' && (
              <Sign_sect onSwitch={() => setActiveSection('login')} />
              )}
              {activeSection === 'reset' && (
              <Password_reset_sect onBack={() => setActiveSection('login')} />
              )}
         </div>
        </>
    )
}
