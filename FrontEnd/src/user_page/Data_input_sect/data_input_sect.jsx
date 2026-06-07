import classes from './data_input_sect.module.scss'

export default function Data_input_sect({
    formData,
    profileFields,
    onChange,
    onSave,
    onReset,
    hasChanges,
}) {
    const handleSubmit = (event) => {
        event.preventDefault()
        onSave()
    }

    return (
        <section className={classes.DataInput}>
            <form className={classes.Panel} onSubmit={handleSubmit}>
                <div className={classes.Header}>
                    <h2>Изменение информации</h2>
                </div>

                <div className={classes.FieldGrid}>
                    {profileFields.map((field) => (
                        <label key={field.key} className={classes.Field}>
                            <span>{field.label}</span>
                            <input
                                type={field.type}
                                placeholder={field.placeholder}
                                autoComplete={field.autoComplete}
                                value={formData[field.key] ?? ''}
                                onChange={(event) => onChange(field.key, event.target.value)}
                            />
                        </label>
                    ))}
                </div>

                <div className={classes.ButtonRow}>
                    <button type="submit" disabled={!hasChanges}>
                        Сохранить изменения
                    </button>
                    <button
                        type="button"
                        className={classes.SecondaryButton}
                        onClick={onReset}
                        disabled={!hasChanges}
                    >
                        Сбросить
                    </button>
                </div>
            </form>
        </section>
    )
}
