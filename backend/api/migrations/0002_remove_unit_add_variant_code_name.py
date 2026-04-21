from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        # Remove unit from Item
        migrations.RemoveField(
            model_name="item",
            name="unit",
        ),
        # Remove color and length from Variant
        migrations.RemoveField(
            model_name="variant",
            name="color",
        ),
        migrations.RemoveField(
            model_name="variant",
            name="length",
        ),
        # Add code and name to Variant
        migrations.AddField(
            model_name="variant",
            name="code",
            field=models.CharField(default="", max_length=50),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="variant",
            name="name",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
    ]
