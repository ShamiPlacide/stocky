from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [("admin", "Admin"), ("staff", "Staff")]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="staff")

    class Meta:
        db_table = "users"


class Item(models.Model):
    UNIT_CHOICES = [("meters", "Meters"), ("boxes", "Boxes")]
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "items"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.unit})"


class Variant(models.Model):
    item = models.ForeignKey(Item, related_name="variants", on_delete=models.CASCADE)
    color = models.CharField(max_length=100)
    length = models.FloatField(null=True, blank=True)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "variants"

    def __str__(self):
        if self.item.unit == "meters":
            return f"{self.item.name} - {self.color} - {self.length}m"
        return f"{self.item.name} - {self.color}"


class Log(models.Model):
    ACTION_CHOICES = [
        ("ADD", "Add"),
        ("REMOVE", "Remove"),
        ("EDIT", "Edit"),
        ("DELETE", "Delete"),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    variant = models.ForeignKey(Variant, on_delete=models.SET_NULL, null=True, blank=True)
    quantity_changed = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "logs"
        ordering = ["-timestamp"]


class DailyReport(models.Model):
    date = models.DateField()
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "daily_reports"
