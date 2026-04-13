import styleses from "./sign_sect.module.scss"
import {useState} from "react"
import axios from 'axios'
import { useNavigate } from "react-router-dom"

export default function Sign_sect({onSwitch}) {
    const navigate = useNavigate();
    const [fio, setFio] = useState('');
    const [password, setPassword] = useState('');
    const [login, setLogin] = useState('');    
    const [street, setStreet] = useState('');
    const [message, setMessage] = useState('');  
    const [data, setData] = useState([])
    
    const handleSubmits = async (e) => {
        e.preventDefault();
        setMessage('');

        try {
            const response = await axios.post('http://localhost:3000/api/auth/register', {
                fio:fio,
                password:password,
                login:login,
                street:street
            });

                setMessage(response.data.message);
                setLogin('');
                setPassword('');
                onSwitch()

            }
            catch (error) {
                const errorMsg = error.response?.data?.error || 'Ошибка регистрации';
                setMessage(errorMsg);
                console.log(error)
            } 
    }
    return (
        <section className={styleses.Register}>
            <main>
                <div>
                    <div>
                        <button type = "button" onClick = {onSwitch}>Вход</button>
                        <button>Регистрация</button>
                    </div>

                    <form onSubmit={handleSubmits}>
                        <h2>Регистрация абонента</h2>

                        <div>
                            <input 
                            type="text" 
                            placeholder="Иванов Иван Иванович"
                            value={fio}
                            onChange={(e) => setFio(e.target.value)} 
                            required
                            />
                        </div>

                        <div>
                            <input
                            type="text"
                            placeholder="Придумайте логин"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)} 
                            required
                            />
                        </div>

                        <div>
                            <input
                            type="text"
                            placeholder="ул. Примерная, д. 1, кв. 1"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)} 
                            required
                            />
                        </div>

                        <div>
                            <div>
                                <input
                                type="new-password"
                                placeholder="Минимум 6 символов"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)} 
                                required
                                />
                                <button type="button">👁️</button>
                            </div>
                        </div>



                        <button type="submit" onClick={handleSubmits}>Зарегистрироваться</button>
                        <p></p>
                    </form>
                </div>
            </main>
        </section>
    )
}