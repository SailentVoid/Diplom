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
                                inputMode={
                                    field.key === 'phone' || field.key === 'birthDate'
                                        ? 'numeric'
                                        : undefined
                                }
                                pattern={
                                    field.key === 'phone'
                                        ? '^\\+375\\(\\d{2}\\)\\d{3}-\\d{2}-\\d{2}$'
                                        : field.key === 'birthDate'
                                            ? '^\\d{2}\\.\\d{2}\\.\\d{4}$'
                                            : undefined
                                }
                                maxLength={field.key === 'birthDate' ? 10 : undefined}
                                value={formData[field.key] ?? ''}
                                onChange={(event) => onChange(field.key, event.target.value)}
                                required
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
