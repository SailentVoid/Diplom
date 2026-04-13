import Avatar_sect from './Avatar_sect/avatar_sect.jsx'
import Data_input_sect from './Data_input_sect/data_input_sect.jsx'
import Data_output_sect from './Data_output_sect/data_output_sect.jsx'
import { useState } from "react"

export default function PageLK() {
    const [isFilled, setIsFilled] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        fullname: "",
        birthdate: "",
        phone: "",
        email: ""
    })

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = () => {
        setIsFilled(true)
        setIsEditing(false)
    }

    if (!isFilled && !isEditing) {
        return <Avatar_sect onStart={() => setIsEditing(true)} />
    }

    if (isEditing) {
        return (
            <Data_input_sect
                formData={formData}
                onChange={handleChange}
                onSave={handleSave}
                onCancel={() => isFilled ? setIsEditing(false) : null}
            />
        )
    }

    return <Data_output_sect userData={formData} />
}
